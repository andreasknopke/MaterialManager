import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  Button,
  Grid,
  TextField,
  CircularProgress,
  Tabs,
  Tab,
} from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
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

const MaterialDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [material, setMaterial] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tabValue, setTabValue] = useState(0);

  useEffect(() => {
    if (id && id !== 'new') {
      fetchMaterial();
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchMaterial = async () => {
    try {
      const response = await materialAPI.getById(parseInt(id!));
      setMaterial(response.data);
    } catch (error) {
      console.error('Fehler beim Laden des Materials:', error);
    } finally {
      setLoading(false);
    }
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
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/materials')}
        >
          Zurück
        </Button>
        {material && (
          <Button
            variant="contained"
            onClick={() => navigate(`/materials/${id}/edit`)}
          >
            Bearbeiten
          </Button>
        )}
      </Box>

      <Typography variant="h4" gutterBottom>
        {material?.name || 'Material Details'}
      </Typography>

      <Paper sx={{ mt: 3 }}>
        <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)}>
          <Tab label="Grunddaten" />
          <Tab label="Barcodes" />
          <Tab label="Historie" />
        </Tabs>

        <TabPanel value={tabValue} index={0}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Bezeichnung"
                value={material?.name || ''}
                disabled
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Kategorie"
                value={material?.category_name || ''}
                disabled
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Firma"
                value={material?.company_name || ''}
                disabled
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Schrank"
                value={material?.cabinet_name || ''}
                disabled
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Größe"
                value={material?.size || ''}
                disabled
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Verfallsdatum"
                value={material?.expiry_date ? new Date(material.expiry_date).toLocaleDateString('de-DE') : ''}
                disabled
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Beschreibung"
                value={material?.description || ''}
                disabled
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Aktueller Bestand"
                value={material?.current_stock || 0}
                type="number"
                disabled
                helperText="Erhöht sich bei Wareneingang, verringert sich bei Entnahme"
              />
            </Grid>
          </Grid>
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <Typography variant="body1">
            Barcode-Verwaltung wird hier angezeigt
          </Typography>
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          <Typography variant="body1">
            Transaktionshistorie wird hier angezeigt
          </Typography>
        </TabPanel>
      </Paper>
    </Box>
  );
};

export default MaterialDetail;
