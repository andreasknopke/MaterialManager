import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  Chip,
  IconButton,
  Alert,
  Divider,
} from '@mui/material';
import {
  Inventory2 as InventoryIcon,
  Delete as DeleteIcon,
  CheckCircle as CheckIcon,
  Warning as WarningIcon,
  QrCodeScanner as QrCodeScannerIcon,
} from '@mui/icons-material';
import { cabinetAPI, materialAPI } from '../services/api';

interface Cabinet {
  id: number;
  name: string;
  location: string;
  description: string;
  capacity: number;
}

interface Material {
  id: number;
  name: string;
  current_stock: number;
  min_stock: number;
  expiry_date: string;
  cabinet_id: number;
}

const Inventory: React.FC = () => {
  const navigate = useNavigate();
  const [cabinets, setCabinets] = useState<Cabinet[]>([]);
  const [selectedCabinet, setSelectedCabinet] = useState<Cabinet | null>(null);
  const [cabinetMaterials, setCabinetMaterials] = useState<Material[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetchCabinets();
  }, []);

  const fetchCabinets = async () => {
    try {
      const response = await cabinetAPI.getAll();
      const data = Array.isArray(response.data) ? response.data : [];
      setCabinets(data);
    } catch (error) {
      console.error('Fehler beim Laden der Schränke:', error);
      setCabinets([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchCabinetMaterials = async (cabinetId: number) => {
    try {
      const response = await materialAPI.getAll();
      const allMaterials = Array.isArray(response.data) ? response.data : [];
      const filtered = allMaterials.filter((m: Material) => m.cabinet_id === cabinetId);
      setCabinetMaterials(filtered);
    } catch (error) {
      console.error('Fehler beim Laden der Materialien:', error);
      setCabinetMaterials([]);
    }
  };

  const handleOpenInventory = async (cabinet: Cabinet) => {
    setSelectedCabinet(cabinet);
    await fetchCabinetMaterials(cabinet.id);
    setDialogOpen(true);
  };

  const handleClearCabinet = async () => {
    if (!selectedCabinet) return;

    try {
      // Nutze den speziellen "clear" Endpoint, der:
      // - Alle Materialien mit usage_type='correction' protokolliert
      // - Die Fächerstruktur erhält
      await cabinetAPI.clear(selectedCabinet.id);
      
      setSuccess(`Schrank "${selectedCabinet.name}" wurde geleert!`);
      setClearDialogOpen(false);
      setDialogOpen(false);
      
      // Aktualisiere die Ansicht
      await fetchCabinets();
      
      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      console.error('Fehler beim Leeren des Schranks:', error);
    }
  };

  const handleStartRefill = () => {
    setDialogOpen(false);
    navigate('/scanner', { 
      state: { 
        autoOpenCamera: true,
        inventoryMode: true,
        cabinetId: selectedCabinet?.id,
        cabinetName: selectedCabinet?.name,
      } 
    });
  };

  const isExpiringSoon = (expiryDate: string) => {
    if (!expiryDate) return false;
    const today = new Date();
    const expiry = new Date(expiryDate);
    const daysUntilExpiry = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntilExpiry <= 30 && daysUntilExpiry >= 0;
  };

  const isExpired = (expiryDate: string) => {
    if (!expiryDate) return false;
    const today = new Date();
    const expiry = new Date(expiryDate);
    return expiry < today;
  };

  const getMaterialCount = (cabinetId: number) => {
    // This would need to be fetched separately for each cabinet
    // For now, we'll add it when opening the dialog
    return '...';
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Inventur
      </Typography>
      <Typography variant="body2" color="text.secondary" gutterBottom sx={{ mb: 3 }}>
        Prüfen Sie den Inhalt der Schränke und führen Sie Inventur durch
      </Typography>

      {success && (
        <Alert severity="success" sx={{ mb: 3 }}>
          {success}
        </Alert>
      )}

      <Grid container spacing={3}>
        {cabinets.map((cabinet) => (
          <Grid item xs={12} sm={6} md={4} key={cabinet.id}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" gap={1} mb={2}>
                  <InventoryIcon color="primary" />
                  <Typography variant="h6">{cabinet.name}</Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  {cabinet.location}
                </Typography>
                {cabinet.description && (
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    {cabinet.description}
                  </Typography>
                )}
                <Chip 
                  label={`Kapazität: ${cabinet.capacity}`} 
                  size="small" 
                  sx={{ mt: 2 }}
                />
              </CardContent>
              <CardActions>
                <Button 
                  size="small" 
                  startIcon={<CheckIcon />}
                  onClick={() => handleOpenInventory(cabinet)}
                  fullWidth
                  variant="outlined"
                >
                  Inventur prüfen
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Inventur Dialog */}
      <Dialog 
        open={dialogOpen} 
        onClose={() => setDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Inventur: {selectedCabinet?.name}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Standort: {selectedCabinet?.location}
          </Typography>
          
          <Divider sx={{ my: 2 }} />
          
          <Typography variant="h6" gutterBottom>
            Materialien im Schrank ({cabinetMaterials.length})
          </Typography>
          
          {cabinetMaterials.length === 0 ? (
            <Alert severity="info" sx={{ mt: 2 }}>
              Dieser Schrank ist leer
            </Alert>
          ) : (
            <List>
              {cabinetMaterials.map((material) => (
                <ListItem 
                  key={material.id}
                  sx={{
                    border: '1px solid #e0e0e0',
                    borderRadius: 1,
                    mb: 1,
                    bgcolor: isExpired(material.expiry_date) ? '#ffebee' : 
                             isExpiringSoon(material.expiry_date) ? '#fff3e0' : 'transparent'
                  }}
                >
                  <ListItemText
                    primary={material.name}
                    secondary={
                      <Box>
                        <Typography variant="body2" component="span">
                          Bestand: {material.current_stock} 
                          {material.current_stock < material.min_stock && (
                            <Chip 
                              label="Niedrig" 
                              size="small" 
                              color="warning" 
                              sx={{ ml: 1 }} 
                            />
                          )}
                        </Typography>
                        {material.expiry_date && (
                          <Typography variant="body2" component="div" sx={{ mt: 0.5 }}>
                            Ablauf: {new Date(material.expiry_date).toLocaleDateString('de-DE')}
                            {isExpired(material.expiry_date) && (
                              <Chip 
                                label="Abgelaufen" 
                                size="small" 
                                color="error" 
                                sx={{ ml: 1 }} 
                              />
                            )}
                            {isExpiringSoon(material.expiry_date) && !isExpired(material.expiry_date) && (
                              <Chip 
                                label="Läuft ab" 
                                size="small" 
                                color="warning" 
                                sx={{ ml: 1 }} 
                              />
                            )}
                          </Typography>
                        )}
                      </Box>
                    }
                  />
                </ListItem>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={() => setDialogOpen(false)}>
            Schließen
          </Button>
          <Button 
            onClick={handleStartRefill}
            variant="contained"
            startIcon={<QrCodeScannerIcon />}
            color="primary"
          >
            Material scannen
          </Button>
          <Button 
            onClick={() => setClearDialogOpen(true)}
            variant="outlined"
            color="error"
            startIcon={<DeleteIcon />}
          >
            Schrank leeren
          </Button>
        </DialogActions>
      </Dialog>

      {/* Bestätigungs-Dialog zum Leeren */}
      <Dialog
        open={clearDialogOpen}
        onClose={() => setClearDialogOpen(false)}
      >
        <DialogTitle>
          Schrank wirklich leeren?
        </DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            <Typography variant="body2">
              <strong>Achtung!</strong> Dies wird alle {cabinetMaterials.length} Materialien 
              aus dem Schrank "{selectedCabinet?.name}" deaktivieren.
            </Typography>
          </Alert>
          <Typography variant="body2">
            Sie können danach neue Materialien hinzufügen, indem Sie Barcodes scannen.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setClearDialogOpen(false)}>
            Abbrechen
          </Button>
          <Button 
            onClick={handleClearCabinet}
            variant="contained"
            color="error"
            startIcon={<DeleteIcon />}
          >
            Ja, leeren
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Inventory;
