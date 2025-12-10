import React, { useEffect, useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,
  Chip,
  Alert,
  CircularProgress,
  Grid,
  Card,
  CardContent,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Business as BusinessIcon,
  Inventory as InventoryIcon,
  Storage as StorageIcon,
} from '@mui/icons-material';
import axios from 'axios';

interface Unit {
  id: number;
  name: string;
  description: string;
  color: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

interface UnitStats {
  materials: number;
  cabinets: number;
  totalStock: number;
  lowStockMaterials: number;
  expiringMaterials: number;
}

interface UnitFormData {
  name: string;
  description: string;
  color: string;
  active: boolean;
}

const Units: React.FC = () => {
  const [units, setUnits] = useState<Unit[]>([]);
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  const [stats, setStats] = useState<Map<number, UnitStats>>(new Map());
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [formData, setFormData] = useState<UnitFormData>({
    name: '',
    description: '',
    color: '#1976d2',
    active: true,
  });

  useEffect(() => {
    fetchUnits();
  }, []);

  const fetchUnits = async () => {
    try {
      const response = await axios.get('/api/units');
      setUnits(response.data);
      
      // Statistiken für jede Einheit laden
      const statsPromises = response.data.map((unit: Unit) =>
        axios.get(`/api/units/${unit.id}/stats`)
      );
      const statsResults = await Promise.all(statsPromises);
      
      const statsMap = new Map<number, UnitStats>();
      response.data.forEach((unit: Unit, index: number) => {
        statsMap.set(unit.id, statsResults[index].data);
      });
      setStats(statsMap);
    } catch (err) {
      console.error('Fehler beim Laden der Einheiten:', err);
      setError('Fehler beim Laden der Einheiten');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (unit?: Unit) => {
    if (unit) {
      setSelectedUnit(unit);
      setFormData({
        name: unit.name,
        description: unit.description || '',
        color: unit.color,
        active: unit.active,
      });
    } else {
      setSelectedUnit(null);
      setFormData({
        name: '',
        description: '',
        color: '#1976d2',
        active: true,
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setSelectedUnit(null);
    setError(null);
  };

  const handleSubmit = async () => {
    try {
      if (selectedUnit) {
        await axios.put(`/api/units/${selectedUnit.id}`, formData);
        setSuccess('Einheit erfolgreich aktualisiert');
      } else {
        await axios.post('/api/units', formData);
        setSuccess('Einheit erfolgreich erstellt');
      }
      handleCloseDialog();
      fetchUnits();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Fehler beim Speichern');
    }
  };

  const handleDelete = async () => {
    if (!selectedUnit) return;

    try {
      await axios.delete(`/api/units/${selectedUnit.id}`);
      setSuccess('Einheit erfolgreich gelöscht');
      setDeleteDialogOpen(false);
      setSelectedUnit(null);
      fetchUnits();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Fehler beim Löschen');
      setDeleteDialogOpen(false);
    }
  };

  const openDeleteDialog = (unit: Unit) => {
    setSelectedUnit(unit);
    setDeleteDialogOpen(true);
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box display="flex" alignItems="center" gap={2}>
          <BusinessIcon sx={{ fontSize: 40 }} />
          <Typography variant="h4">Einheiten / Abteilungen</Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          Neue Einheit
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      {/* Statistik-Karten */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {units.map((unit) => {
          const unitStats = stats.get(unit.id);
          return (
            <Grid item xs={12} sm={6} md={3} key={unit.id}>
              <Card>
                <CardContent>
                  <Box display="flex" alignItems="center" gap={1} mb={1}>
                    <Box
                      sx={{
                        width: 12,
                        height: 12,
                        borderRadius: '50%',
                        bgcolor: unit.color,
                      }}
                    />
                    <Typography variant="h6" noWrap>
                      {unit.name}
                    </Typography>
                  </Box>
                  {unitStats && (
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        <InventoryIcon fontSize="small" sx={{ verticalAlign: 'middle', mr: 0.5 }} />
                        {unitStats.materials} Materialien
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        <StorageIcon fontSize="small" sx={{ verticalAlign: 'middle', mr: 0.5 }} />
                        {unitStats.cabinets} Schränke
                      </Typography>
                      {unitStats.lowStockMaterials > 0 && (
                        <Chip
                          label={`${unitStats.lowStockMaterials} niedrig`}
                          size="small"
                          color="warning"
                          sx={{ mt: 1, mr: 0.5 }}
                        />
                      )}
                      {unitStats.expiringMaterials > 0 && (
                        <Chip
                          label={`${unitStats.expiringMaterials} ablaufend`}
                          size="small"
                          color="error"
                          sx={{ mt: 1 }}
                        />
                      )}
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      {/* Tabelle */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Farbe</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Beschreibung</TableCell>
              <TableCell>Materialien</TableCell>
              <TableCell>Schränke</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Aktionen</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {units.map((unit) => {
              const unitStats = stats.get(unit.id);
              return (
                <TableRow key={unit.id}>
                  <TableCell>
                    <Box
                      sx={{
                        width: 30,
                        height: 30,
                        borderRadius: 1,
                        bgcolor: unit.color,
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body1" fontWeight="medium">
                      {unit.name}
                    </Typography>
                  </TableCell>
                  <TableCell>{unit.description || '-'}</TableCell>
                  <TableCell>{unitStats?.materials || 0}</TableCell>
                  <TableCell>{unitStats?.cabinets || 0}</TableCell>
                  <TableCell>
                    <Chip
                      label={unit.active ? 'Aktiv' : 'Inaktiv'}
                      color={unit.active ? 'success' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      onClick={() => handleOpenDialog(unit)}
                      color="primary"
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => openDeleteDialog(unit)}
                      color="error"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {selectedUnit ? 'Einheit bearbeiten' : 'Neue Einheit erstellen'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              fullWidth
              label="Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
            <TextField
              fullWidth
              label="Beschreibung"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              multiline
              rows={2}
            />
            <Box>
              <Typography variant="body2" gutterBottom>
                Farbe (für UI-Darstellung)
              </Typography>
              <Box display="flex" gap={1} alignItems="center">
                <TextField
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  sx={{ width: 100 }}
                />
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: 1,
                    bgcolor: formData.color,
                    border: '1px solid #ccc',
                  }}
                />
              </Box>
            </Box>
            <Box>
              <Typography variant="body2" gutterBottom>
                Status
              </Typography>
              <Button
                variant={formData.active ? 'contained' : 'outlined'}
                onClick={() => setFormData({ ...formData, active: !formData.active })}
                color={formData.active ? 'success' : 'inherit'}
              >
                {formData.active ? 'Aktiv' : 'Inaktiv'}
              </Button>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Abbrechen</Button>
          <Button onClick={handleSubmit} variant="contained" disabled={!formData.name}>
            {selectedUnit ? 'Aktualisieren' : 'Erstellen'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Einheit löschen?</DialogTitle>
        <DialogContent>
          <Typography>
            Möchten Sie die Einheit "{selectedUnit?.name}" wirklich löschen?
          </Typography>
          <Alert severity="warning" sx={{ mt: 2 }}>
            Die Einheit kann nur gelöscht werden, wenn keine Materialien oder Schränke
            zugeordnet sind.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Abbrechen</Button>
          <Button onClick={handleDelete} color="error" variant="contained">
            Löschen
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Units;
