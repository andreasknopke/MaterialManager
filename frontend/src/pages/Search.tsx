import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Grid,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  InputAdornment,
  IconButton,
  Tooltip,
  Card,
  CardContent,
} from '@mui/material';
import {
  Search as SearchIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  CheckCircle as CheckCircleIcon,
  Clear as ClearIcon,
  Visibility as ViewIcon,
} from '@mui/icons-material';
import { materialAPI, categoryAPI } from '../services/api';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

interface SearchResult {
  id: number;
  name: string;
  article_number: string | null;
  lot_number: string | null;
  expiry_date: string | null;
  current_stock: number;
  cabinet_name: string | null;
  compartment_name: string | null;
  category_name: string | null;
  size: string | null;
}

const Search: React.FC = () => {
  const navigate = useNavigate();
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<any[]>([]);

  // Suchfelder
  const [lotSearch, setLotSearch] = useState('');
  const [expiryMonths, setExpiryMonths] = useState<number>(3);
  const [freeTextSearch, setFreeTextSearch] = useState('');
  const [categorySearch, setCategorySearch] = useState<number | ''>('');

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const response = await categoryAPI.getAll();
      setCategories(response.data || []);
    } catch (err) {
      console.error('Fehler beim Laden der Kategorien:', err);
    }
  };

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
    setResults([]);
    setError(null);
  };

  // Chargen-Suche (LOT)
  const handleLotSearch = async () => {
    if (!lotSearch.trim()) {
      setError('Bitte geben Sie eine Chargennummer ein');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await materialAPI.search({ lot_number: lotSearch.trim() });
      setResults(response.data || []);
      if ((response.data || []).length === 0) {
        setError('Keine Materialien mit dieser Chargennummer gefunden');
      }
    } catch (err) {
      console.error('Suchfehler:', err);
      setError('Fehler bei der Suche');
    } finally {
      setLoading(false);
    }
  };

  // Verfallsdatum-Suche
  const handleExpirySearch = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await materialAPI.search({ expiry_months: expiryMonths });
      setResults(response.data || []);
      if ((response.data || []).length === 0) {
        setError(`Keine Materialien mit Verfall in den nächsten ${expiryMonths} Monaten gefunden`);
      }
    } catch (err) {
      console.error('Suchfehler:', err);
      setError('Fehler bei der Suche');
    } finally {
      setLoading(false);
    }
  };

  // Freitext-Suche
  const handleFreeTextSearch = async () => {
    if (!freeTextSearch.trim()) {
      setError('Bitte geben Sie einen Suchbegriff ein');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await materialAPI.search({ query: freeTextSearch.trim() });
      setResults(response.data || []);
      if ((response.data || []).length === 0) {
        setError('Keine Materialien gefunden');
      }
    } catch (err) {
      console.error('Suchfehler:', err);
      setError('Fehler bei der Suche');
    } finally {
      setLoading(false);
    }
  };

  // Kategorie-Suche
  const handleCategorySearch = async () => {
    if (!categorySearch) {
      setError('Bitte wählen Sie eine Kategorie');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await materialAPI.search({ category_id: categorySearch });
      setResults(response.data || []);
      if ((response.data || []).length === 0) {
        setError('Keine Materialien in dieser Kategorie gefunden');
      }
    } catch (err) {
      console.error('Suchfehler:', err);
      setError('Fehler bei der Suche');
    } finally {
      setLoading(false);
    }
  };

  // Verfallsdatum-Status
  const getExpiryStatus = (expiryDate: string | null) => {
    if (!expiryDate) return { status: 'none', label: 'Kein Datum', color: 'default' as const };
    
    const expiry = new Date(expiryDate);
    const today = new Date();
    const diffDays = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      return { status: 'expired', label: 'Abgelaufen', color: 'error' as const, icon: <ErrorIcon fontSize="small" /> };
    } else if (diffDays <= 30) {
      return { status: 'critical', label: `${diffDays} Tage`, color: 'error' as const, icon: <WarningIcon fontSize="small" /> };
    } else if (diffDays <= 90) {
      return { status: 'warning', label: `${diffDays} Tage`, color: 'warning' as const, icon: <WarningIcon fontSize="small" /> };
    }
    return { status: 'ok', label: `${diffDays} Tage`, color: 'success' as const, icon: <CheckCircleIcon fontSize="small" /> };
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('de-DE');
  };

  const clearResults = () => {
    setResults([]);
    setError(null);
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Material-Suche
      </Typography>

      <Paper sx={{ mb: 3 }}>
        <Tabs 
          value={tabValue} 
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab label="🔍 Freitext" />
          <Tab label="📦 Chargen (LOT)" />
          <Tab label="⏰ Verfallsdatum" />
          <Tab label="📁 Kategorie" />
        </Tabs>
      </Paper>

      {/* Freitext-Suche */}
      <TabPanel value={tabValue} index={0}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Freitext-Suche
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Suchen Sie nach Materialname, Artikelnummer, Beschreibung oder Notizen.
            </Typography>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} sm={8}>
                <TextField
                  fullWidth
                  label="Suchbegriff"
                  value={freeTextSearch}
                  onChange={(e) => setFreeTextSearch(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleFreeTextSearch()}
                  placeholder="z.B. Katheter, Schlauch, REF12345..."
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon />
                      </InputAdornment>
                    ),
                    endAdornment: freeTextSearch && (
                      <InputAdornment position="end">
                        <IconButton size="small" onClick={() => setFreeTextSearch('')}>
                          <ClearIcon />
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <Button
                  variant="contained"
                  fullWidth
                  onClick={handleFreeTextSearch}
                  disabled={loading}
                  startIcon={<SearchIcon />}
                >
                  Suchen
                </Button>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </TabPanel>

      {/* Chargen-Suche */}
      <TabPanel value={tabValue} index={1}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Chargen-Suche (LOT) für Rückrufe
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Geben Sie die Chargennummer (LOT) ein, um alle betroffenen Materialien zu finden.
              Ideal für Produktrückrufe.
            </Typography>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} sm={8}>
                <TextField
                  fullWidth
                  label="Chargennummer (LOT)"
                  value={lotSearch}
                  onChange={(e) => setLotSearch(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleLotSearch()}
                  placeholder="z.B. LOT2024-001, 23456A..."
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon />
                      </InputAdornment>
                    ),
                    endAdornment: lotSearch && (
                      <InputAdornment position="end">
                        <IconButton size="small" onClick={() => setLotSearch('')}>
                          <ClearIcon />
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <Button
                  variant="contained"
                  fullWidth
                  onClick={handleLotSearch}
                  disabled={loading}
                  startIcon={<SearchIcon />}
                  color="warning"
                >
                  Rückruf-Suche
                </Button>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </TabPanel>

      {/* Verfallsdatum-Suche */}
      <TabPanel value={tabValue} index={2}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Verfallsdatum-Suche
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Finden Sie Materialien, die in den nächsten X Monaten ablaufen.
            </Typography>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} sm={4}>
                <FormControl fullWidth>
                  <InputLabel>Zeitraum</InputLabel>
                  <Select
                    value={expiryMonths}
                    onChange={(e) => setExpiryMonths(e.target.value as number)}
                    label="Zeitraum"
                  >
                    <MenuItem value={1}>1 Monat</MenuItem>
                    <MenuItem value={2}>2 Monate</MenuItem>
                    <MenuItem value={3}>3 Monate</MenuItem>
                    <MenuItem value={6}>6 Monate</MenuItem>
                    <MenuItem value={12}>12 Monate</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Button
                  variant="contained"
                  fullWidth
                  onClick={handleExpirySearch}
                  disabled={loading}
                  startIcon={<WarningIcon />}
                  color="error"
                >
                  Ablaufende suchen
                </Button>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Alert severity="info" sx={{ py: 0.5 }}>
                  Zeigt auch bereits abgelaufene Materialien
                </Alert>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </TabPanel>

      {/* Kategorie-Suche */}
      <TabPanel value={tabValue} index={3}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Kategorie-Suche
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Zeigen Sie alle Materialien einer bestimmten Kategorie an.
            </Typography>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} sm={8}>
                <FormControl fullWidth>
                  <InputLabel>Kategorie</InputLabel>
                  <Select
                    value={categorySearch}
                    onChange={(e) => setCategorySearch(e.target.value as number | '')}
                    label="Kategorie"
                  >
                    <MenuItem value="">
                      <em>Bitte wählen...</em>
                    </MenuItem>
                    {categories.map((cat) => (
                      <MenuItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Button
                  variant="contained"
                  fullWidth
                  onClick={handleCategorySearch}
                  disabled={loading}
                  startIcon={<SearchIcon />}
                >
                  Kategorie anzeigen
                </Button>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </TabPanel>

      {/* Fehler-Anzeige */}
      {error && (
        <Alert severity="warning" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Ergebnisse */}
      {results.length > 0 && (
        <Paper sx={{ mt: 3 }}>
          <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">
              Suchergebnisse ({results.length} Treffer)
            </Typography>
            <Button size="small" onClick={clearResults} startIcon={<ClearIcon />}>
              Ergebnisse löschen
            </Button>
          </Box>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Material</TableCell>
                  <TableCell>Artikelnr.</TableCell>
                  <TableCell>Charge (LOT)</TableCell>
                  <TableCell>Verfall</TableCell>
                  <TableCell align="right">Bestand</TableCell>
                  <TableCell>Standort</TableCell>
                  <TableCell>Kategorie</TableCell>
                  <TableCell align="center">Aktion</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {results.map((item) => {
                  const expiryStatus = getExpiryStatus(item.expiry_date);
                  return (
                    <TableRow key={item.id} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {item.name}
                        </Typography>
                        {item.size && (
                          <Typography variant="caption" color="text.secondary">
                            {item.size}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>{item.article_number || '-'}</TableCell>
                      <TableCell>
                        {item.lot_number ? (
                          <Chip 
                            label={item.lot_number} 
                            size="small" 
                            variant="outlined"
                          />
                        ) : '-'}
                      </TableCell>
                      <TableCell>
                        {item.expiry_date ? (
                          <Tooltip title={expiryStatus.label}>
                            <Chip 
                              label={formatDate(item.expiry_date)}
                              size="small"
                              color={expiryStatus.color}
                              icon={expiryStatus.icon}
                            />
                          </Tooltip>
                        ) : '-'}
                      </TableCell>
                      <TableCell align="right">
                        <Chip 
                          label={item.current_stock}
                          size="small"
                          color={item.current_stock <= 0 ? 'error' : 'default'}
                        />
                      </TableCell>
                      <TableCell>
                        {item.cabinet_name || '-'}
                        {item.compartment_name && (
                          <Typography variant="caption" display="block" color="text.secondary">
                            {item.compartment_name}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        {item.category_name || '-'}
                      </TableCell>
                      <TableCell align="center">
                        <Tooltip title="Details anzeigen">
                          <IconButton
                            size="small"
                            onClick={() => navigate(`/materials/${item.id}`)}
                          >
                            <ViewIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}
    </Box>
  );
};

export default Search;
