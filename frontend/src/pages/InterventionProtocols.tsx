import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
} from '@mui/material';
import {
  Search as SearchIcon,
  Visibility as ViewIcon,
  Delete as DeleteIcon,
  Print as PrintIcon,
  Close as CloseIcon,
  Receipt as ReceiptIcon,
  LocalHospital as HospitalIcon,
  Edit as EditIcon,
  Add as AddIcon,
  Assignment as AssignmentIcon,
} from '@mui/icons-material';
import { interventionAPI } from '../services/api';

interface ProtocolItem {
  id: number;
  material_name: string;
  article_number: string;
  lot_number: string;
  expiry_date: string | null;
  gtin: string;
  quantity: number;
  taken_at: string;
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

const InterventionProtocols: React.FC = () => {
  const navigate = useNavigate();
  const [protocols, setProtocols] = useState<Protocol[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [gtinFilter, setGtinFilter] = useState('');
  const [lotFilter, setLotFilter] = useState('');
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);

  // Detail-Dialog
  const [selectedProtocol, setSelectedProtocol] = useState<Protocol | null>(null);
  const [protocolItems, setProtocolItems] = useState<ProtocolItem[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);

  // Löschen-Bestätigung
  const [deleteProtocol, setDeleteProtocol] = useState<Protocol | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadProtocols = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await interventionAPI.getAll({
        search: search || undefined,
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
        gtin: gtinFilter || undefined,
        lot_number: lotFilter || undefined,
        limit,
        offset: (page - 1) * limit,
      });
      setProtocols(response.data.protocols);
      setTotal(response.data.total);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProtocols();
  }, [page]);

  const handleSearch = () => {
    setPage(1);
    loadProtocols();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleViewDetail = async (protocol: Protocol) => {
    setSelectedProtocol(protocol);
    setDetailLoading(true);
    setShowDetailDialog(true);
    
    try {
      const response = await interventionAPI.getById(protocol.id);
      setProtocolItems(response.data.items);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Fehler beim Laden der Details');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteProtocol) return;
    
    setDeleting(true);
    try {
      await interventionAPI.delete(deleteProtocol.id);
      setDeleteProtocol(null);
      loadProtocols();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Fehler beim Löschen');
    } finally {
      setDeleting(false);
    }
  };

  const handlePrint = () => {
    if (!selectedProtocol) return;
    
    // Generiere UDI-Strings für QR-Codes (Format: (01)GTIN(17)EXPIRY(10)LOT)
    const generateUDI = (gtin: string, lot: string, expiryDate: string | null) => {
      let udi = '';
      if (gtin) udi += `(01)${gtin}`;
      // Verfallsdatum im Format YYMMDD (AI 17)
      if (expiryDate) {
        const date = new Date(expiryDate);
        const yy = String(date.getFullYear()).slice(-2);
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        udi += `(17)${yy}${mm}${dd}`;
      }
      if (lot) udi += `(10)${lot}`;
      return udi;
    };
    
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Interventions-Protokoll ${selectedProtocol.patient_id}</title>
            <script src="https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js"></script>
            <style>
              body { font-family: Arial, sans-serif; padding: 20px; }
              h1 { font-size: 18px; margin-bottom: 10px; }
              .patient-info { margin: 10px 0; padding: 10px; background: #f0f0f0; }
              table { width: 100%; border-collapse: collapse; margin-top: 20px; }
              th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; vertical-align: middle; }
              th { background-color: #f5f5f5; }
              .footer { margin-top: 30px; font-size: 11px; color: #666; }
              .qr-cell { text-align: center; width: 70px; }
              .qr-cell img { width: 50px; height: 50px; }
              .udi-text { font-size: 8px; color: #666; word-break: break-all; max-width: 60px; }
            </style>
          </head>
          <body>
            <h1>Interventions-Protokoll</h1>
            <div class="patient-info">
              <strong>Patient:</strong> ${selectedProtocol.patient_id}
              ${selectedProtocol.patient_name ? ` (${selectedProtocol.patient_name})` : ''}<br>
              <strong>Datum:</strong> ${new Date(selectedProtocol.started_at).toLocaleDateString('de-DE')} 
              ${new Date(selectedProtocol.started_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} - 
              ${new Date(selectedProtocol.ended_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
            </div>
            <table>
              <thead>
                <tr>
                  <th>Zeit</th>
                  <th>Material</th>
                  <th>Artikel-Nr.</th>
                  <th>LOT</th>
                  <th>Menge</th>
                  <th>UDI</th>
                </tr>
              </thead>
              <tbody>
                ${protocolItems.map((item, idx) => {
                  const udi = generateUDI(item.article_number || item.gtin || '', item.lot_number || '', item.expiry_date);
                  return `
                  <tr>
                    <td>${new Date(item.taken_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</td>
                    <td>${item.material_name}</td>
                    <td>${item.article_number || '-'}</td>
                    <td>${item.lot_number || '-'}</td>
                    <td>${item.quantity}</td>
                    <td class="qr-cell">
                      ${udi ? `<div id="qr-${idx}"></div><div class="udi-text">${udi}</div>` : '-'}
                    </td>
                  </tr>
                `}).join('')}
              </tbody>
            </table>
            <div class="footer">
              Gedruckt am: ${new Date().toLocaleString('de-DE')}
            </div>
            <script>
              // QR-Codes generieren nach dem Laden
              window.onload = function() {
                ${protocolItems.map((item, idx) => {
                  const udi = generateUDI(item.article_number || item.gtin || '', item.lot_number || '', item.expiry_date);
                  if (!udi) return '';
                  return `
                    try {
                      var qr${idx} = qrcode(0, 'M');
                      qr${idx}.addData('${udi}');
                      qr${idx}.make();
                      document.getElementById('qr-${idx}').innerHTML = qr${idx}.createImgTag(2, 0);
                    } catch(e) { console.error('QR Error:', e); }
                  `;
                }).join('')}
                
                // Drucken nach kurzer Verzögerung (damit QR-Codes gerendert sind)
                setTimeout(function() { window.print(); }, 300);
              };
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('de-DE');
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <Box sx={{ p: { xs: 1, sm: 2 } }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 2 }}>
        <Typography variant="h4" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <HospitalIcon color="primary" />
          Gespeicherte Interventionsprotokolle
        </Typography>
        <Button
          variant="contained"
          color="secondary"
          startIcon={<AssignmentIcon />}
          onClick={() => navigate('/patient-assignment')}
        >
          Nachträgliche Zuordnung
        </Button>
      </Box>

      {/* Suchbereich */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <TextField
            label="Suche"
            placeholder="Patient-ID, Name..."
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
        </Box>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Protokoll-Liste */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      ) : protocols.length === 0 ? (
        <Alert severity="info">
          Keine Interventionsprotokolle gefunden.
        </Alert>
      ) : (
        <>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Datum</TableCell>
                  <TableCell>Patient-ID</TableCell>
                  <TableCell>Name</TableCell>
                  <TableCell>Zeitraum</TableCell>
                  <TableCell align="center">Entnahmen</TableCell>
                  <TableCell>Erstellt von</TableCell>
                  <TableCell align="center">Aktionen</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {protocols.map((protocol) => (
                  <TableRow key={protocol.id} hover>
                    <TableCell>{formatDate(protocol.started_at)}</TableCell>
                    <TableCell>
                      <Chip label={protocol.patient_id} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell>{protocol.patient_name || '-'}</TableCell>
                    <TableCell>
                      {formatTime(protocol.started_at)} - {formatTime(protocol.ended_at)}
                    </TableCell>
                    <TableCell align="center">
                      <Chip label={protocol.item_count} size="small" color="primary" />
                    </TableCell>
                    <TableCell>{protocol.created_by_name || '-'}</TableCell>
                    <TableCell align="center">
                      <Tooltip title="Details anzeigen">
                        <IconButton size="small" onClick={() => handleViewDetail(protocol)}>
                          <ViewIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Löschen">
                        <IconButton size="small" color="error" onClick={() => setDeleteProtocol(protocol)}>
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
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
        </>
      )}

      {/* Detail-Dialog */}
      <Dialog
        open={showDetailDialog}
        onClose={() => setShowDetailDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Box display="flex" alignItems="center" gap={1}>
              <ReceiptIcon color="primary" />
              Interventions-Protokoll
            </Box>
            <IconButton onClick={() => setShowDetailDialog(false)}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          {selectedProtocol && (
            <>
              <Paper sx={{ p: 2, mb: 2, bgcolor: 'grey.100' }}>
                <Typography variant="body2">
                  <strong>Patient:</strong> {selectedProtocol.patient_id}
                  {selectedProtocol.patient_name && ` (${selectedProtocol.patient_name})`}
                </Typography>
                <Typography variant="body2">
                  <strong>Datum:</strong> {formatDate(selectedProtocol.started_at)}
                </Typography>
                <Typography variant="body2">
                  <strong>Zeitraum:</strong> {formatTime(selectedProtocol.started_at)} - {formatTime(selectedProtocol.ended_at)}
                </Typography>
                {selectedProtocol.created_by_name && (
                  <Typography variant="body2">
                    <strong>Erstellt von:</strong> {selectedProtocol.created_by_name}
                  </Typography>
                )}
              </Paper>

              {detailLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                  <CircularProgress />
                </Box>
              ) : (
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Zeit</TableCell>
                        <TableCell>Material</TableCell>
                        <TableCell>Artikel-Nr.</TableCell>
                        <TableCell>LOT</TableCell>
                        <TableCell align="center">Kons.</TableCell>
                        <TableCell align="right">Menge</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {protocolItems.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>{formatTime(item.taken_at)}</TableCell>
                          <TableCell>{item.material_name}</TableCell>
                          <TableCell>{item.article_number || '-'}</TableCell>
                          <TableCell>{item.lot_number || '-'}</TableCell>
                          <TableCell align="center">
                            {item.is_consignment ? (
                              <Chip label="K" size="small" color="info" title="Konsignation" />
                            ) : '-'}
                          </TableCell>
                          <TableCell align="right">{item.quantity}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={handlePrint} variant="contained" startIcon={<PrintIcon />}>
            Drucken
          </Button>
          <Button onClick={() => setShowDetailDialog(false)} variant="outlined">
            Schließen
          </Button>
        </DialogActions>
      </Dialog>

      {/* Löschen-Bestätigung */}
      <Dialog open={!!deleteProtocol} onClose={() => setDeleteProtocol(null)}>
        <DialogTitle>Protokoll löschen?</DialogTitle>
        <DialogContent>
          <Typography>
            Möchten Sie das Protokoll für Patient <strong>{deleteProtocol?.patient_id}</strong> vom{' '}
            <strong>{deleteProtocol && formatDate(deleteProtocol.started_at)}</strong> wirklich löschen?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteProtocol(null)}>Abbrechen</Button>
          <Button onClick={handleDelete} color="error" variant="contained" disabled={deleting}>
            {deleting ? <CircularProgress size={20} /> : 'Löschen'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default InterventionProtocols;
