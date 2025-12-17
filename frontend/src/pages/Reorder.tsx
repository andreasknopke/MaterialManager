import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, ToggleButton, ToggleButtonGroup, Chip,
  CircularProgress, IconButton, Collapse, Dialog, DialogContent,
  Button, Divider, Alert, Tooltip, Snackbar, Stack, Checkbox,
  Tab, Tabs, TextField, InputAdornment, DialogTitle, DialogActions
} from '@mui/material';
import {
  Today as TodayIcon,
  DateRange as DateRangeIcon,
  CalendarMonth as CalendarMonthIcon,
  Print as PrintIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  QrCode as QrCodeIcon,
  ShoppingCart as ShoppingCartIcon,
  ContentCopy as CopyIcon,
  History as HistoryIcon,
  Search as SearchIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';
import { QRCodeSVG } from 'qrcode.react';
import api from '../services/api';

interface StockOutItem {
  product_id: number;
  gtin: string;
  product_name: string;
  company_name: string | null;
  total_out: number;
  transaction_count: number;
  current_total_stock: number;
  lot_numbers: string;
  earliest_expiry: string | null;
  last_transaction: string;
  // Device-Eigenschaften
  shaft_length: string | null;
  device_length: string | null;
  device_diameter: string | null;
  french_size: string | null;
  size: string | null;
}

interface Transaction {
  id: number;
  quantity: number;
  transaction_date: string;
  notes: string | null;
  user_name: string | null;
  lot_number: string;
  expiry_date: string | null;
  gtin: string;
  product_name: string;
  cabinet_name: string | null;
}

interface ReorderHistoryItem {
  id: number;
  product_id: number;
  gtin: string | null;
  product_name: string;
  quantity_ordered: number;
  ordered_at: string;
  ordered_by: number | null;
  ordered_by_name: string | null;
  notes: string | null;
  status: 'ordered' | 'received' | 'cancelled';
  received_at: string | null;
  company_name: string | null;
  shaft_length: string | null;
  device_length: string | null;
  device_diameter: string | null;
  french_size: string | null;
}

// GS1 UDI QR-Code generieren (AI 01 = GTIN, 10 = LOT, 17 = Expiry)
const generateGS1String = (gtin: string, lot: string, expiry: string | null): string => {
  // GS1 Format: (01)GTIN(10)LOT(17)YYMMDD
  // FNC1 wird als GS (ASCII 29) dargestellt, hier als ]d2 für QR
  let gs1 = `01${gtin.padStart(14, '0')}`;
  
  if (lot) {
    gs1 += `10${lot}`;
  }
  
  if (expiry) {
    // Datum zu YYMMDD konvertieren
    const date = new Date(expiry);
    const yy = String(date.getFullYear()).slice(-2);
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    gs1 += `17${yy}${mm}${dd}`;
  }
  
  return gs1;
};

const formatDate = (dateStr: string | null): string => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('de-DE');
};

const formatDateTime = (dateStr: string): string => {
  return new Date(dateStr).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const Reorder: React.FC = () => {
  const [period, setPeriod] = useState<string>('today');
  const [loading, setLoading] = useState(true);
  const [stockOuts, setStockOuts] = useState<StockOutItem[]>([]);
  const [totalQuantity, setTotalQuantity] = useState(0);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [enlargedQR, setEnlargedQR] = useState<{ gtin: string; lot: string; expiry: string | null } | null>(null);
  const [copySnackbar, setCopySnackbar] = useState(false);
  
  // Tab-State
  const [activeTab, setActiveTab] = useState(0);
  
  // Bestellhistorie State
  const [history, setHistory] = useState<ReorderHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [historyPeriod, setHistoryPeriod] = useState<string>('all');
  const [historyStatus, setHistoryStatus] = useState<string>('all');
  
  // Nachbestellungs-State
  const [orderedProducts, setOrderedProducts] = useState<Set<number>>(new Set());
  const [orderSnackbar, setOrderSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' });
  
  // Dialog State
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; item: ReorderHistoryItem | null; action: 'receive' | 'cancel' | 'delete' }>({ open: false, item: null, action: 'receive' });

  useEffect(() => {
    fetchStockOuts();
    fetchOrderedProducts();
  }, [period]);

  useEffect(() => {
    if (activeTab === 1) {
      fetchHistory();
    }
  }, [activeTab, historySearch, historyPeriod, historyStatus]);

  const fetchStockOuts = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/reorder/stock-outs?period=${period}`);
      setStockOuts(response.data.stockOuts);
      setTotalQuantity(response.data.totalQuantity);
    } catch (error) {
      console.error('Fehler beim Laden:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchOrderedProducts = async () => {
    try {
      const response = await api.get('/reorder/history?status=ordered');
      const orderedIds = new Set<number>(response.data.map((item: ReorderHistoryItem) => item.product_id));
      setOrderedProducts(orderedIds);
    } catch (error) {
      console.error('Fehler beim Laden der bestellten Produkte:', error);
    }
  };

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const params = new URLSearchParams();
      if (historyStatus !== 'all') params.append('status', historyStatus);
      if (historyPeriod !== 'all') params.append('period', historyPeriod);
      if (historySearch) params.append('search', historySearch);
      
      const response = await api.get(`/reorder/history?${params.toString()}`);
      setHistory(response.data);
    } catch (error) {
      console.error('Fehler beim Laden der Historie:', error);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleMarkOrdered = async (item: StockOutItem, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.post('/reorder/mark-ordered', {
        product_id: item.product_id,
        gtin: item.gtin,
        product_name: item.product_name,
        quantity_ordered: item.total_out
      });
      setOrderedProducts(prev => new Set(prev).add(item.product_id));
      setOrderSnackbar({ open: true, message: `"${item.product_name}" als nachbestellt markiert`, severity: 'success' });
    } catch (error) {
      console.error('Fehler:', error);
      setOrderSnackbar({ open: true, message: 'Fehler beim Markieren', severity: 'error' });
    }
  };

  const handleUpdateStatus = async (id: number, status: 'received' | 'cancelled') => {
    try {
      await api.put(`/reorder/history/${id}`, { status });
      fetchHistory();
      fetchOrderedProducts();
      setOrderSnackbar({ open: true, message: status === 'received' ? 'Als empfangen markiert' : 'Storniert', severity: 'success' });
    } catch (error) {
      console.error('Fehler:', error);
      setOrderSnackbar({ open: true, message: 'Fehler beim Aktualisieren', severity: 'error' });
    }
    setConfirmDialog({ open: false, item: null, action: 'receive' });
  };

  const handleDeleteOrder = async (id: number) => {
    try {
      await api.delete(`/reorder/history/${id}`);
      fetchHistory();
      fetchOrderedProducts();
      setOrderSnackbar({ open: true, message: 'Eintrag gelöscht', severity: 'success' });
    } catch (error) {
      console.error('Fehler:', error);
      setOrderSnackbar({ open: true, message: 'Fehler beim Löschen', severity: 'error' });
    }
    setConfirmDialog({ open: false, item: null, action: 'delete' });
  };

  const fetchTransactions = async (productId: number) => {
    setLoadingTransactions(true);
    try {
      const response = await api.get(`/reorder/stock-outs/${productId}/transactions?period=${period}`);
      setTransactions(response.data);
    } catch (error) {
      console.error('Fehler beim Laden der Transaktionen:', error);
    } finally {
      setLoadingTransactions(false);
    }
  };

  const handleRowClick = (productId: number) => {
    if (expandedRow === productId) {
      setExpandedRow(null);
    } else {
      setExpandedRow(productId);
      fetchTransactions(productId);
    }
  };

  const handleCopyGtin = async (gtin: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(gtin);
      setCopySnackbar(true);
    } catch (err) {
      console.error('Kopieren fehlgeschlagen:', err);
    }
  };

  // Device-Info Chips generieren
  const getDeviceInfoChips = (item: StockOutItem) => {
    const chips: { label: string; color: 'default' | 'primary' | 'secondary' | 'info' }[] = [];
    if (item.size) chips.push({ label: item.size, color: 'default' });
    if (item.french_size) chips.push({ label: `${item.french_size} Fr`, color: 'info' });
    if (item.device_length) chips.push({ label: `L: ${item.device_length}`, color: 'primary' });
    if (item.device_diameter) chips.push({ label: `Ø ${item.device_diameter}`, color: 'secondary' });
    if (item.shaft_length) chips.push({ label: `Schaft: ${item.shaft_length}`, color: 'default' });
    return chips;
  };

  const handlePrint = () => {
    window.print();
  };

  const getPeriodLabel = (): string => {
    switch (period) {
      case 'today': return 'Heute';
      case '3days': return 'Letzte 3 Tage';
      case 'week': return 'Letzte Woche';
      case 'month': return 'Letzter Monat';
      default: return '';
    }
  };

  return (
    <Box sx={{ p: { xs: 1, sm: 3 } }}>
      {/* Header */}
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        mb: 3,
        flexWrap: 'wrap',
        gap: 2
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ShoppingCartIcon color="primary" sx={{ fontSize: 32 }} />
          <Typography variant="h4" sx={{ fontSize: { xs: '1.5rem', sm: '2rem' } }}>
            Nachbestellung
          </Typography>
        </Box>
        
        <Button
          variant="outlined"
          startIcon={<PrintIcon />}
          onClick={handlePrint}
          className="no-print"
        >
          Drucken
        </Button>
      </Box>

      {/* Tabs */}
      <Paper sx={{ mb: 3 }} className="no-print">
        <Tabs value={activeTab} onChange={(_, val) => setActiveTab(val)}>
          <Tab icon={<ShoppingCartIcon />} label="Materialausgänge" iconPosition="start" />
          <Tab icon={<HistoryIcon />} label="Bestellhistorie" iconPosition="start" />
        </Tabs>
      </Paper>

      {/* TAB 0: Materialausgänge */}
      {activeTab === 0 && (
        <>
          {/* Zeitraum-Auswahl */}
          <Paper sx={{ p: 2, mb: 3 }} className="no-print">
            <Typography variant="subtitle2" gutterBottom>
              Zeitraum wählen:
            </Typography>
            <ToggleButtonGroup
              value={period}
              exclusive
              onChange={(_, value) => value && setPeriod(value)}
          sx={{ flexWrap: 'wrap' }}
        >
          <ToggleButton value="today">
            <TodayIcon sx={{ mr: 1 }} />
            Heute
          </ToggleButton>
          <ToggleButton value="3days">
            <DateRangeIcon sx={{ mr: 1 }} />
            3 Tage
          </ToggleButton>
          <ToggleButton value="week">
            <DateRangeIcon sx={{ mr: 1 }} />
            Woche
          </ToggleButton>
          <ToggleButton value="month">
            <CalendarMonthIcon sx={{ mr: 1 }} />
            Monat
          </ToggleButton>
        </ToggleButtonGroup>
      </Paper>

      {/* Zusammenfassung für Druck */}
      <Box sx={{ mb: 2, display: 'none' }} className="print-only">
        <Typography variant="h5">
          Materialausgänge - {getPeriodLabel()}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Erstellt am: {new Date().toLocaleString('de-DE')}
        </Typography>
        <Divider sx={{ my: 1 }} />
      </Box>

      {/* Statistik */}
      {!loading && (
        <Alert severity="info" sx={{ mb: 2 }}>
          <strong>{stockOuts.length} Produkte</strong> mit insgesamt <strong>{totalQuantity} Entnahmen</strong> im Zeitraum "{getPeriodLabel()}"
        </Alert>
      )}

      {/* Tabelle */}
      {loading ? (
        <Box display="flex" justifyContent="center" py={4}>
          <CircularProgress />
        </Box>
      ) : stockOuts.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">
            Keine Materialausgänge im gewählten Zeitraum
          </Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ backgroundColor: 'primary.main' }}>
                <TableCell sx={{ color: 'white', width: 40 }}></TableCell>
                <TableCell sx={{ color: 'white', width: 60, textAlign: 'center' }} className="no-print">Bestellt</TableCell>
                <TableCell sx={{ color: 'white' }}>Produkt</TableCell>
                <TableCell sx={{ color: 'white' }}>GTIN</TableCell>
                <TableCell sx={{ color: 'white' }}>Hersteller</TableCell>
                <TableCell sx={{ color: 'white' }}>Eigenschaften</TableCell>
                <TableCell sx={{ color: 'white', textAlign: 'center' }}>Entnahmen</TableCell>
                <TableCell sx={{ color: 'white', textAlign: 'center' }}>Bestand</TableCell>
                <TableCell sx={{ color: 'white' }}>Chargen</TableCell>
                <TableCell sx={{ color: 'white', textAlign: 'center' }} className="no-print">QR</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {stockOuts.map((item) => (
                <React.Fragment key={item.product_id}>
                  <TableRow 
                    hover 
                    onClick={() => handleRowClick(item.product_id)}
                    sx={{ 
                      cursor: 'pointer',
                      backgroundColor: orderedProducts.has(item.product_id) ? 'success.light' :
                                       item.current_total_stock <= 0 ? 'error.light' : 
                                       item.current_total_stock <= 2 ? 'warning.light' : 'inherit'
                    }}
                  >
                    <TableCell>
                      <IconButton size="small">
                        {expandedRow === item.product_id ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                      </IconButton>
                    </TableCell>
                    <TableCell align="center" className="no-print">
                      <Tooltip title={orderedProducts.has(item.product_id) ? 'Bereits als nachbestellt markiert' : 'Als nachbestellt markieren'}>
                        <Checkbox
                          checked={orderedProducts.has(item.product_id)}
                          onChange={(e) => !orderedProducts.has(item.product_id) && handleMarkOrdered(item, e as any)}
                          onClick={(e) => e.stopPropagation()}
                          color="success"
                          disabled={orderedProducts.has(item.product_id)}
                        />
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      <Typography fontWeight="medium">{item.product_name}</Typography>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Typography variant="body2" fontFamily="monospace">
                          {item.gtin}
                        </Typography>
                        <Tooltip title="GTIN kopieren">
                          <IconButton 
                            size="small" 
                            onClick={(e) => handleCopyGtin(item.gtin, e)}
                            className="no-print"
                          >
                            <CopyIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                    <TableCell>{item.company_name || '-'}</TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                        {getDeviceInfoChips(item).map((chip, idx) => (
                          <Chip 
                            key={idx}
                            label={chip.label} 
                            size="small" 
                            color={chip.color}
                            variant="outlined"
                            sx={{ fontSize: '0.7rem', height: 20 }}
                          />
                        ))}
                        {getDeviceInfoChips(item).length === 0 && '-'}
                      </Stack>
                    </TableCell>
                    <TableCell align="center">
                      <Chip 
                        label={Number(item.total_out)} 
                        color="error" 
                        size="small"
                        sx={{ fontWeight: 'bold' }}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Chip 
                        label={Number(item.current_total_stock) || 0} 
                        color={item.current_total_stock <= 0 ? 'error' : 
                               item.current_total_stock <= 2 ? 'warning' : 'success'}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.lot_numbers || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell align="center" className="no-print">
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          const lots = item.lot_numbers?.split(', ') || [''];
                          setEnlargedQR({ 
                            gtin: item.gtin, 
                            lot: lots[0], 
                            expiry: item.earliest_expiry 
                          });
                        }}
                      >
                        <QrCodeIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>

                  {/* Expandierte Details */}
                  <TableRow>
                    <TableCell colSpan={10} sx={{ py: 0 }}>
                      <Collapse in={expandedRow === item.product_id} timeout="auto" unmountOnExit>
                        <Box sx={{ py: 2, px: 3, backgroundColor: 'grey.50' }}>
                          <Typography variant="subtitle2" gutterBottom>
                            Einzelne Entnahmen:
                          </Typography>
                          
                          {loadingTransactions ? (
                            <CircularProgress size={24} />
                          ) : (
                            <Table size="small">
                              <TableHead>
                                <TableRow>
                                  <TableCell>Datum</TableCell>
                                  <TableCell>Menge</TableCell>
                                  <TableCell>Charge (LOT)</TableCell>
                                  <TableCell>Verfallsdatum</TableCell>
                                  <TableCell>Schrank</TableCell>
                                  <TableCell>Benutzer</TableCell>
                                  <TableCell className="no-print">QR-Code</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {transactions.map((tx) => (
                                  <TableRow key={tx.id}>
                                    <TableCell>{formatDateTime(tx.transaction_date)}</TableCell>
                                    <TableCell>
                                      <Chip label={Math.abs(tx.quantity)} size="small" color="error" />
                                    </TableCell>
                                    <TableCell sx={{ fontFamily: 'monospace' }}>{tx.lot_number || '-'}</TableCell>
                                    <TableCell>{formatDate(tx.expiry_date)}</TableCell>
                                    <TableCell>{tx.cabinet_name || '-'}</TableCell>
                                    <TableCell>{tx.user_name || '-'}</TableCell>
                                    <TableCell className="no-print">
                                      <Box 
                                        sx={{ 
                                          cursor: 'pointer',
                                          '&:hover': { transform: 'scale(1.1)' },
                                          transition: 'transform 0.2s'
                                        }}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setEnlargedQR({ 
                                            gtin: tx.gtin, 
                                            lot: tx.lot_number, 
                                            expiry: tx.expiry_date 
                                          });
                                        }}
                                      >
                                        <QRCodeSVG 
                                          value={generateGS1String(tx.gtin, tx.lot_number, tx.expiry_date)}
                                          size={40}
                                        />
                                      </Box>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          )}
                        </Box>
                      </Collapse>
                    </TableCell>
                  </TableRow>
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
        </>
      )}

      {/* TAB 1: Bestellhistorie */}
      {activeTab === 1 && (
        <>
          {/* Filter */}
          <Paper sx={{ p: 2, mb: 3 }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
              <TextField
                size="small"
                placeholder="Suche nach Produkt, GTIN, Hersteller..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                sx={{ minWidth: 300 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  )
                }}
              />
              <ToggleButtonGroup
                value={historyStatus}
                exclusive
                onChange={(_, val) => val && setHistoryStatus(val)}
                size="small"
              >
                <ToggleButton value="all">Alle</ToggleButton>
                <ToggleButton value="ordered">Offen</ToggleButton>
                <ToggleButton value="received">Empfangen</ToggleButton>
                <ToggleButton value="cancelled">Storniert</ToggleButton>
              </ToggleButtonGroup>
              <ToggleButtonGroup
                value={historyPeriod}
                exclusive
                onChange={(_, val) => val && setHistoryPeriod(val)}
                size="small"
              >
                <ToggleButton value="all">Gesamt</ToggleButton>
                <ToggleButton value="today">Heute</ToggleButton>
                <ToggleButton value="week">Woche</ToggleButton>
                <ToggleButton value="month">Monat</ToggleButton>
              </ToggleButtonGroup>
            </Stack>
          </Paper>

          {/* Historie-Tabelle */}
          {historyLoading ? (
            <Box display="flex" justifyContent="center" py={4}>
              <CircularProgress />
            </Box>
          ) : history.length === 0 ? (
            <Paper sx={{ p: 4, textAlign: 'center' }}>
              <Typography color="text.secondary">
                Keine Bestellungen gefunden
              </Typography>
            </Paper>
          ) : (
            <TableContainer component={Paper}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ backgroundColor: 'primary.main' }}>
                    <TableCell sx={{ color: 'white' }}>Datum</TableCell>
                    <TableCell sx={{ color: 'white' }}>Produkt</TableCell>
                    <TableCell sx={{ color: 'white' }}>GTIN</TableCell>
                    <TableCell sx={{ color: 'white' }}>Hersteller</TableCell>
                    <TableCell sx={{ color: 'white', textAlign: 'center' }}>Menge</TableCell>
                    <TableCell sx={{ color: 'white' }}>Bestellt von</TableCell>
                    <TableCell sx={{ color: 'white', textAlign: 'center' }}>Status</TableCell>
                    <TableCell sx={{ color: 'white', textAlign: 'center' }}>Aktionen</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {history.map((item) => (
                    <TableRow 
                      key={item.id}
                      sx={{ 
                        backgroundColor: item.status === 'received' ? 'success.light' : 
                                        item.status === 'cancelled' ? 'grey.200' : 'inherit'
                      }}
                    >
                      <TableCell>
                        <Typography variant="body2">
                          {new Date(item.ordered_at).toLocaleDateString('de-DE')}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {new Date(item.ordered_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography fontWeight="medium">{item.product_name}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontFamily="monospace">{item.gtin || '-'}</Typography>
                      </TableCell>
                      <TableCell>{item.company_name || '-'}</TableCell>
                      <TableCell align="center">
                        <Chip label={item.quantity_ordered} size="small" color="primary" />
                      </TableCell>
                      <TableCell>{item.ordered_by_name || '-'}</TableCell>
                      <TableCell align="center">
                        <Chip 
                          label={item.status === 'ordered' ? 'Bestellt' : item.status === 'received' ? 'Empfangen' : 'Storniert'}
                          size="small"
                          color={item.status === 'ordered' ? 'warning' : item.status === 'received' ? 'success' : 'default'}
                        />
                      </TableCell>
                      <TableCell align="center">
                        {item.status === 'ordered' && (
                          <Stack direction="row" spacing={0.5} justifyContent="center">
                            <Tooltip title="Als empfangen markieren">
                              <IconButton 
                                size="small" 
                                color="success"
                                onClick={() => setConfirmDialog({ open: true, item, action: 'receive' })}
                              >
                                <CheckCircleIcon />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Stornieren">
                              <IconButton 
                                size="small" 
                                color="warning"
                                onClick={() => setConfirmDialog({ open: true, item, action: 'cancel' })}
                              >
                                <CancelIcon />
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        )}
                        {item.status !== 'ordered' && (
                          <Tooltip title="Löschen">
                            <IconButton 
                              size="small" 
                              color="error"
                              onClick={() => setConfirmDialog({ open: true, item, action: 'delete' })}
                            >
                              <DeleteIcon />
                            </IconButton>
                          </Tooltip>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </>
      )}

      {/* QR-Code Dialog (vergrößert) */}
      <Dialog 
        open={!!enlargedQR} 
        onClose={() => setEnlargedQR(null)}
        maxWidth="sm"
      >
        <DialogContent sx={{ textAlign: 'center', p: 4 }}>
          {enlargedQR && (
            <>
              <Typography variant="h6" gutterBottom>
                GS1 UDI QR-Code
              </Typography>
              <Box sx={{ my: 3, p: 2, backgroundColor: 'white', display: 'inline-block' }}>
                <QRCodeSVG 
                  value={generateGS1String(enlargedQR.gtin, enlargedQR.lot, enlargedQR.expiry)}
                  size={250}
                  level="M"
                />
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                <strong>GTIN (01):</strong> {enlargedQR.gtin}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                <strong>Charge (10):</strong> {enlargedQR.lot || '-'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                <strong>Verfall (17):</strong> {formatDate(enlargedQR.expiry)}
              </Typography>
              <Divider sx={{ my: 2 }} />
              <Typography variant="caption" fontFamily="monospace" sx={{ wordBreak: 'break-all' }}>
                {generateGS1String(enlargedQR.gtin, enlargedQR.lot, enlargedQR.expiry)}
              </Typography>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Print Styles */}
      <style>{`
        @media print {
          .no-print {
            display: none !important;
          }
          .print-only {
            display: block !important;
          }
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>

      {/* Copy Snackbar */}
      <Snackbar
        open={copySnackbar}
        autoHideDuration={2000}
        onClose={() => setCopySnackbar(false)}
        message="GTIN in Zwischenablage kopiert"
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />

      {/* Order Snackbar */}
      <Snackbar
        open={orderSnackbar.open}
        autoHideDuration={3000}
        onClose={() => setOrderSnackbar({ ...orderSnackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={orderSnackbar.severity} onClose={() => setOrderSnackbar({ ...orderSnackbar, open: false })}>
          {orderSnackbar.message}
        </Alert>
      </Snackbar>

      {/* Bestätigungs-Dialog */}
      <Dialog open={confirmDialog.open} onClose={() => setConfirmDialog({ open: false, item: null, action: 'receive' })}>
        <DialogTitle>
          {confirmDialog.action === 'receive' && 'Als empfangen markieren?'}
          {confirmDialog.action === 'cancel' && 'Bestellung stornieren?'}
          {confirmDialog.action === 'delete' && 'Eintrag löschen?'}
        </DialogTitle>
        <DialogContent>
          <Typography>
            {confirmDialog.item?.product_name}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialog({ open: false, item: null, action: 'receive' })}>
            Abbrechen
          </Button>
          {confirmDialog.action === 'receive' && (
            <Button 
              variant="contained" 
              color="success"
              onClick={() => confirmDialog.item && handleUpdateStatus(confirmDialog.item.id, 'received')}
            >
              Empfangen
            </Button>
          )}
          {confirmDialog.action === 'cancel' && (
            <Button 
              variant="contained" 
              color="warning"
              onClick={() => confirmDialog.item && handleUpdateStatus(confirmDialog.item.id, 'cancelled')}
            >
              Stornieren
            </Button>
          )}
          {confirmDialog.action === 'delete' && (
            <Button 
              variant="contained" 
              color="error"
              onClick={() => confirmDialog.item && handleDeleteOrder(confirmDialog.item.id)}
            >
              Löschen
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Reorder;
