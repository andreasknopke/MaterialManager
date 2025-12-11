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
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
} from '@mui/material';
import {
  Inventory as InventoryIcon,
  Warning as WarningIcon,
  EventBusy as EventBusyIcon,
  Storage as StorageIcon,
  QrCodeScannerIcon,
  Category as CategoryIcon,
} from '@mui/icons-material';
import { materialAPI, cabinetAPI, categoryAPI } from '../services/api';

interface Stats {
  totalMaterials: number;
  lowStockCount: number;
  expiringCount: number;
  totalCabinets: number;
  totalCategories: number;
}

interface CategoryStock {
  id: number;
  name: string;
  min_quantity: number;
  total_stock: number;
  material_count: number;
  stock_status: 'ok' | 'low' | 'empty';
}

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats>({
    totalMaterials: 0,
    lowStockCount: 0,
    expiringCount: 0,
    totalCabinets: 0,
    totalCategories: 0,
  });
  const [categoryStocks, setCategoryStocks] = useState<CategoryStock[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [materials, expiring, cabinets, categoryStats] = await Promise.all([
          materialAPI.getAll(),
          materialAPI.getExpiring(),
          cabinetAPI.getAll(),
          categoryAPI.getInventoryStats(),
        ]);

        const materialsData = Array.isArray(materials.data) ? materials.data : [];
        const expiringData = Array.isArray(expiring.data) ? expiring.data : [];
        const cabinetsData = Array.isArray(cabinets.data) ? cabinets.data : [];
        const categoryData = Array.isArray(categoryStats.data) ? categoryStats.data : [];

        // Nur aktive Materialien zählen
        const activeMaterials = materialsData.filter((m: any) => m.active);

        // Kategorien mit niedrigem Bestand
        const lowStockCategories = categoryData.filter((cat: CategoryStock) => 
          cat.stock_status === 'low' || cat.stock_status === 'empty'
        );

        const newStats = {
          totalMaterials: activeMaterials.length,
          lowStockCount: lowStockCategories.length,
          expiringCount: expiringData.length,
          totalCabinets: cabinetsData.length,
          totalCategories: categoryData.length,
        };

        setStats(newStats);
        setCategoryStocks(categoryData);
      } catch (error) {
        console.error('Fehler beim Laden der Statistiken:', error);
        setStats({
          totalMaterials: 0,
          lowStockCount: 0,
          expiringCount: 0,
          totalCabinets: 0,
          totalCategories: 0,
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
      onClick: () => navigate('/materials'),
    },
    {
      title: 'Kategorien mit niedrigem Bestand',
      value: stats.lowStockCount,
      icon: <WarningIcon sx={{ fontSize: 40 }} />,
      color: '#ff9800',
      onClick: () => navigate('/categories'),
    },
    {
      title: 'Ablaufende Materialien',
      value: stats.expiringCount,
      icon: <EventBusyIcon sx={{ fontSize: 40 }} />,
      color: '#f44336',
      onClick: () => navigate('/materials', { state: { filter: 'expiring' } }),
    },
    {
      title: 'Schränke',
      value: stats.totalCabinets,
      icon: <StorageIcon sx={{ fontSize: 40 }} />,
      color: '#4caf50',
      onClick: () => navigate('/cabinets'),
    },
  ];

  // Kategorien mit niedrigem oder leerem Bestand
  const lowStockCategories = categoryStocks.filter(cat => 
    cat.stock_status === 'low' || cat.stock_status === 'empty'
  );

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
            <Card 
              sx={{ 
                height: '100%',
                cursor: 'pointer',
                transition: 'all 0.2s',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: 4,
                }
              }}
              onClick={card.onClick}
            >
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

      {/* Kategorien mit niedrigem Bestand */}
      {lowStockCategories.length > 0 && (
        <Grid container spacing={3} sx={{ mt: 2 }}>
          <Grid item xs={12}>
            <Paper sx={{ p: 3 }}>
              <Box display="flex" alignItems="center" gap={1} mb={2}>
                <WarningIcon color="warning" />
                <Typography variant="h6">
                  Kategorien mit niedrigem Bestand
                </Typography>
              </Box>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Kategorie</TableCell>
                      <TableCell align="right">Aktueller Bestand</TableCell>
                      <TableCell align="right">Mindestmenge</TableCell>
                      <TableCell align="right">Anzahl Materialien</TableCell>
                      <TableCell>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {lowStockCategories.map((category) => (
                      <TableRow 
                        key={category.id}
                        hover
                        sx={{ cursor: 'pointer' }}
                        onClick={() => navigate('/materials', { state: { categoryFilter: category.id } })}
                      >
                        <TableCell>{category.name}</TableCell>
                        <TableCell align="right">{category.total_stock}</TableCell>
                        <TableCell align="right">{category.min_quantity}</TableCell>
                        <TableCell align="right">{category.material_count}</TableCell>
                        <TableCell>
                          <Chip 
                            label={
                              category.stock_status === 'empty' ? 'Leer' : 'Niedrig'
                            }
                            color={category.stock_status === 'empty' ? 'error' : 'warning'}
                            size="small"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Grid>
        </Grid>
      )}
      </Grid>

      <Grid container spacing={3} sx={{ mt: 2 }}>
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Willkommen im Material Manager
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Verwalten Sie Ihre medizinischen Materialien effizient und übersichtlich.
              Nutzen Sie die Navigation links, um auf die verschiedenen Funktionen zuzugreifen.
            </Typography>
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" component="div">
                <strong>Funktionen:</strong>
                <ul>
                  <li>Materialverwaltung mit Barcode-Unterstützung</li>
                  <li>Schrankorganisation</li>
                  <li>Ein- und Ausgangsbuchungen</li>
                  <li>Bestandsüberwachung und Warnungen</li>
                  <li>Verfallsdatum-Tracking</li>
                  <li>Berichte und Auswertungen</li>
                </ul>
              </Typography>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;
