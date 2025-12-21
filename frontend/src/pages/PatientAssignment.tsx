import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Chip,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip,
  InputAdornment,
  CircularProgress,
  Pagination,
  Checkbox,
  Tabs,
  Tab,
  Divider,
  Autocomplete,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Badge,
} from '@mui/material';
import {
  Search as SearchIcon,
  Add as AddIcon,
  PersonAdd as PersonAddIcon,
  Close as CloseIcon,
  Assignment as AssignmentIcon,
  LocalHospital as HospitalIcon,
  ArrowForward as ArrowForwardIcon,
  FilterList as FilterIcon,
  Clear as ClearIcon,
  Visibility as ViewIcon,
} from '@mui/icons-material';
import { interventionAPI, categoryAPI } from '../services/api';

interface UnassignedTransaction {
  transaction_id: number;
  material_id: number;
  material_name: string;
  article_number: string | null;
  lot_number: string | null;
  expiry_date: string | null;
  quantity: number;
  transaction_date: string;
  usage_type: string;
  notes: string | null;
  reference_number: string | null;
  performed_by: string | null;
  unit_name: string | null;
  category_name: string | null;
  is_consignment: boolean;
}

interface Protocol {
  id: number;
  patient_id: string;
  patient_name: string | null;
  started_at: string;
  ended_at: string;
  total_items: number;
  notes: string | null;
  created_by_name: string | null;
  item_count: number;
}

interface Category {
  id: number;
  name: string;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </div>
  );
}

const PatientAssignment: React.FC = () => {
  // Tab-Auswahl
  const [tabValue, setTabValue] = useState(0);
  
  // Nicht zugeordnete Transaktionen
  const [transactions, setTransactions] = useState<UnassignedTransaction[]>([]);
  const [selectedTransactions, setSelectedTransactions] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Filter
  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [gtinFilter, setGtinFilter] = useState('');
  const [lotFilter, setLotFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<number | ''>('');
  const [categories, setCategories] = useState<Category[]>([]);
  
  // Pagination
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  
  // Bestehende Protokolle
  const [protocols, setProtocols] = useState<Protocol[]>([]);
  const [protocolsLoading, setProtocolsLoading] = useState(false);
  const [protocolSearch, setProtocolSearch] = useState('');
  
  // Dialog: Neues Protokoll erstellen
  const [showNewProtocolDialog, setShowNewProtocolDialog] = useState(false);
  const [newPatientId, setNewPatientId] = useState('');
  const [newPatientName, setNewPatientName] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [creating, setCreating] = useState(false);
  
  // Dialog: Zu bestehendem Protokoll hinzufügen
  const [showAddToProtocolDialog, setShowAddToProtocolDialog] = useState(false);
  const [selectedProtocol, setSelectedProtocol] = useState<Protocol | null>(null);
  const [adding, setAdding] = useState(false);

  // Kategorien laden
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const response = await categoryAPI.getAll();
        setCategories(response.data);
      } catch (err) {
        console.error('Fehler beim Laden der Kategorien:', err);
      }
    };
    loadCategories();
  }, []);

  // Nicht zugeordnete Transaktionen laden
  const loadTransactions = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await interventionAPI.getUnassignedTransactions({
        search: search || undefined,
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
        gtin: gtinFilter || undefined,
        lot_number: lotFilter || undefined,
        category_id: categoryFilter || undefined,
        limit,
        offset: (page - 1) * limit,
      });
      setTransactions(response.data.transactions);
      setTotal(response.data.total);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Fehler beim Laden der nicht zugeordneten Ausgänge');
    } finally {
      setLoading(false);
    }
  };

  // Protokolle laden (für Hinzufügen-Dialog)
  const loadProtocols = async (searchTerm?: string) => {
    setProtocolsLoading(true);
    try {
      const response = await interventionAPI.getAll({
        search: searchTerm || undefined,
        limit: 10,
        offset: 0,
      });
      setProtocols(response.data.protocols);
    } catch (err: any) {
      console.error('Fehler beim Laden der Protokolle:', err);
    } finally {
      setProtocolsLoading(false);
    }
  };

  useEffect(() => {
    loadTransactions();
  }, [page]);

  useEffect(() => {
    if (showAddToProtocolDialog) {
      loadProtocols();
    }
  }, [showAddToProtocolDialog]);

  const handleSearch = () => {
    setPage(1);
    setSelectedTransactions([]);
    loadTransactions();
  };

  const handleClearFilters = () => {
    setSearch('');
    setFromDate('');
    setToDate('');
    setGtinFilter('');
    setLotFilter('');
    setCategoryFilter('');
    setPage(1);
    setSelectedTransactions([]);
    setTimeout(loadTransactions, 100);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // Selektion
  const handleSelectTransaction = (id: number) => {
    setSelectedTransactions(prev =>
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedTransactions.length === transactions.length) {
      setSelectedTransactions([]);
    } else {
      setSelectedTransactions(transactions.map(t => t.transaction_id));
    }
  };

  // Neues Protokoll erstellen
  const handleCreateNewProtocol = async () => {
    if (!newPatientId.trim()) {
      setError('Patienten-ID ist erforderlich');
      return;
    }
    
    setCreating(true);
    setError('');
    try {
      await interventionAPI.createFromTransactions({
        patient_id: newPatientId.trim(),
        patient_name: newPatientName.trim() || undefined,
        notes: newNotes.trim() || undefined,
        transaction_ids: selectedTransactions,
      });
      
      setSuccess(`Protokoll für Patient ${newPatientId} mit ${selectedTransactions.length} Materialausgängen erstellt`);
      setShowNewProtocolDialog(false);
      setNewPatientId('');
      setNewPatientName('');
      setNewNotes('');
      setSelectedTransactions([]);
      loadTransactions();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Fehler beim Erstellen des Protokolls');
    } finally {
      setCreating(false);
    }
  };

  // Zu bestehendem Protokoll hinzufügen
  const handleAddToProtocol = async () => {
    if (!selectedProtocol) {
      setError('Bitte wählen Sie ein Protokoll aus');
      return;
    }
    
    setAdding(true);
    setError('');
    try {
      const response = await interventionAPI.addItemsToProtocol(selectedProtocol.id, selectedTransactions);
      
      setSuccess(`${response.data.added_count} Materialausgänge zum Protokoll von Patient ${selectedProtocol.patient_id} hinzugefügt`);
      setShowAddToProtocolDialog(false);
      setSelectedProtocol(null);
      setSelectedTransactions([]);
      loadTransactions();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Fehler beim Hinzufügen zum Protokoll');
    } finally {
      setAdding(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('de-DE');
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDateTime = (dateStr: string) => {
    return `${formatDate(dateStr)} ${formatTime(dateStr)}`;
  };

  const getUsageTypeLabel = (type: string) => {
    switch (type) {
      case 'patient_use':
        return { label: 'Patient', color: 'primary' as const };
      case 'destock':
        return { label: 'Entnahme', color: 'default' as const };
      case 'correction':
        return { label: 'Korrektur', color: 'warning' as const };
      default:
        return { label: type, color: 'default' as const };
    }
  };

  return (
    <Box sx={{ p: { xs: 1, sm: 2 } }}>
      <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <AssignmentIcon color="primary" />
        Nachträgliche Patientenzuordnung
      </Typography>
      
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Hier können Sie Materialausgänge, die noch keinem Patienten zugeordnet sind, 
        nachträglich einem bestehenden oder neuen Interventionsprotokoll zuordnen.
      </Typography>

      {/* Erfolgs- und Fehlermeldungen */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      {/* Suchbereich */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="subtitle2" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
          <FilterIcon fontSize="small" />
          Filter für nicht zugeordnete Materialausgänge
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <TextField
            label="Suche"
            placeholder="Material, Notizen..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyPress={handleKeyPress}
            size="small"
            sx={{ minWidth: 200 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
          <TextField
            label="GTIN / Artikelnr."
            placeholder="GTIN..."
            value={gtinFilter}
            onChange={(e) => setGtinFilter(e.target.value)}
            onKeyPress={handleKeyPress}
            size="small"
            sx={{ minWidth: 150 }}
          />
          <TextField
            label="LOT-Nummer"
            placeholder="LOT..."
            value={lotFilter}
            onChange={(e) => setLotFilter(e.target.value)}
            onKeyPress={handleKeyPress}
            size="small"
            sx={{ minWidth: 150 }}
          />
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Kategorie</InputLabel>
            <Select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as number | '')}
              label="Kategorie"
            >
              <MenuItem value="">Alle</MenuItem>
              {categories.map((cat) => (
                <MenuItem key={cat.id} value={cat.id}>{cat.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label="Von Datum"
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            size="small"
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            label="Bis Datum"
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            size="small"
            InputLabelProps={{ shrink: true }}
          />
          <Button variant="contained" onClick={handleSearch} startIcon={<SearchIcon />}>
            Suchen
          </Button>
          <Button variant="outlined" onClick={handleClearFilters} startIcon={<ClearIcon />}>
            Zurücksetzen
          </Button>
        </Box>
      </Paper>

      {/* Aktionsleiste */}
      {selectedTransactions.length > 0 && (
        <Paper sx={{ p: 2, mb: 2, bgcolor: 'primary.50' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            <Badge badgeContent={selectedTransactions.length} color="primary">
              <Chip label="Ausgewählt" variant="outlined" />
            </Badge>
            <Button
              variant="contained"
              color="primary"
              startIcon={<PersonAddIcon />}
              onClick={() => setShowNewProtocolDialog(true)}
            >
              Neues Protokoll erstellen
            </Button>
            <Button
              variant="outlined"
              color="primary"
              startIcon={<AddIcon />}
              onClick={() => setShowAddToProtocolDialog(true)}
            >
              Zu bestehendem Protokoll hinzufügen
            </Button>
          </Box>
        </Paper>
      )}

      {/* Transaktionsliste */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      ) : transactions.length === 0 ? (
        <Alert severity="info">
          Keine nicht zugeordneten Materialausgänge gefunden. 
          {(search || fromDate || toDate || gtinFilter || lotFilter || categoryFilter) && 
            ' Versuchen Sie, die Filterkriterien anzupassen.'}
        </Alert>
      ) : (
        <>
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={selectedTransactions.length === transactions.length}
                      indeterminate={selectedTransactions.length > 0 && selectedTransactions.length < transactions.length}
                      onChange={handleSelectAll}
                    />
                  </TableCell>
                  <TableCell>Datum/Zeit</TableCell>
                  <TableCell>Material</TableCell>
                  <TableCell>Artikelnr.</TableCell>
                  <TableCell>LOT</TableCell>
                  <TableCell align="center">Menge</TableCell>
                  <TableCell>Typ</TableCell>
                  <TableCell>Kategorie</TableCell>
                  <TableCell>Benutzer</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {transactions.map((transaction) => {
                  const isSelected = selectedTransactions.includes(transaction.transaction_id);
                  const usageType = getUsageTypeLabel(transaction.usage_type);
                  
                  return (
                    <TableRow 
                      key={transaction.transaction_id} 
                      hover
                      selected={isSelected}
                      onClick={() => handleSelectTransaction(transaction.transaction_id)}
                      sx={{ cursor: 'pointer' }}
                    >
                      <TableCell padding="checkbox">
                        <Checkbox checked={isSelected} />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {formatDate(transaction.transaction_date)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {formatTime(transaction.transaction_date)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {transaction.material_name}
                        </Typography>
                        {transaction.is_consignment && (
                          <Chip label="K" size="small" color="info" sx={{ ml: 1 }} title="Konsignation" />
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontFamily="monospace">
                          {transaction.article_number || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontFamily="monospace">
                          {transaction.lot_number || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Chip label={transaction.quantity} size="small" color="error" variant="outlined" />
                      </TableCell>
                      <TableCell>
                        <Chip label={usageType.label} size="small" color={usageType.color} variant="outlined" />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {transaction.category_name || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {transaction.performed_by || '-'}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>

          {total > limit && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
              <Pagination
                count={Math.ceil(total / limit)}
                page={page}
                onChange={(_, newPage) => setPage(newPage)}
                color="primary"
              />
            </Box>
          )}

          <Typography variant="body2" color="text.secondary" sx={{ mt: 2, textAlign: 'center' }}>
            {total} nicht zugeordnete Materialausgänge gefunden
          </Typography>
        </>
      )}

      {/* Dialog: Neues Protokoll erstellen */}
      <Dialog
        open={showNewProtocolDialog}
        onClose={() => setShowNewProtocolDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <PersonAddIcon color="primary" />
            Neues Interventionsprotokoll erstellen
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          <Alert severity="info" sx={{ mb: 2 }}>
            {selectedTransactions.length} Materialausgänge werden dem neuen Protokoll zugeordnet.
          </Alert>
          
          <TextField
            label="Patienten-ID *"
            placeholder="Barcode oder ID scannen..."
            value={newPatientId}
            onChange={(e) => setNewPatientId(e.target.value)}
            fullWidth
            sx={{ mb: 2 }}
            autoFocus
          />
          
          <TextField
            label="Patientenname (optional)"
            value={newPatientName}
            onChange={(e) => setNewPatientName(e.target.value)}
            fullWidth
            sx={{ mb: 2 }}
          />
          
          <TextField
            label="Notizen (optional)"
            value={newNotes}
            onChange={(e) => setNewNotes(e.target.value)}
            fullWidth
            multiline
            rows={3}
            placeholder="z.B. Nachträglich erfasst, Grund der Zuordnung..."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowNewProtocolDialog(false)}>
            Abbrechen
          </Button>
          <Button
            onClick={handleCreateNewProtocol}
            variant="contained"
            disabled={creating || !newPatientId.trim()}
            startIcon={creating ? <CircularProgress size={16} /> : <PersonAddIcon />}
          >
            Protokoll erstellen
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: Zu bestehendem Protokoll hinzufügen */}
      <Dialog
        open={showAddToProtocolDialog}
        onClose={() => setShowAddToProtocolDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <AddIcon color="primary" />
            Zu bestehendem Protokoll hinzufügen
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          <Alert severity="info" sx={{ mb: 2 }}>
            {selectedTransactions.length} Materialausgänge werden dem ausgewählten Protokoll hinzugefügt.
          </Alert>
          
          <TextField
            label="Protokoll suchen"
            placeholder="Patient-ID oder Name..."
            value={protocolSearch}
            onChange={(e) => {
              setProtocolSearch(e.target.value);
              loadProtocols(e.target.value);
            }}
            fullWidth
            sx={{ mb: 2 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
          
          {protocolsLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
              <CircularProgress size={24} />
            </Box>
          ) : (
            <TableContainer sx={{ maxHeight: 300 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox"></TableCell>
                    <TableCell>Patient-ID</TableCell>
                    <TableCell>Name</TableCell>
                    <TableCell>Datum</TableCell>
                    <TableCell align="center">Items</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {protocols.map((protocol) => (
                    <TableRow
                      key={protocol.id}
                      hover
                      selected={selectedProtocol?.id === protocol.id}
                      onClick={() => setSelectedProtocol(protocol)}
                      sx={{ cursor: 'pointer' }}
                    >
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={selectedProtocol?.id === protocol.id}
                          onChange={() => setSelectedProtocol(protocol)}
                        />
                      </TableCell>
                      <TableCell>
                        <Chip label={protocol.patient_id} size="small" variant="outlined" />
                      </TableCell>
                      <TableCell>{protocol.patient_name || '-'}</TableCell>
                      <TableCell>{formatDate(protocol.started_at)}</TableCell>
                      <TableCell align="center">
                        <Chip label={protocol.item_count} size="small" color="primary" />
                      </TableCell>
                    </TableRow>
                  ))}
                  {protocols.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} align="center">
                        <Typography variant="body2" color="text.secondary">
                          Keine Protokolle gefunden
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowAddToProtocolDialog(false)}>
            Abbrechen
          </Button>
          <Button
            onClick={handleAddToProtocol}
            variant="contained"
            disabled={adding || !selectedProtocol}
            startIcon={adding ? <CircularProgress size={16} /> : <AddIcon />}
          >
            Hinzufügen
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PatientAssignment;
