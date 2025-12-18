import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Card,
  CardContent,
  Grid,
  Chip,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
  Pagination,
  CircularProgress,
  Alert,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import {
  Refresh as RefreshIcon,
  FilterList as FilterIcon,
  Visibility as ViewIcon,
  Person as PersonIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Login as LoginIcon,
  Logout as LogoutIcon,
  Download as DownloadIcon,
  Upload as UploadIcon,
  SwapHoriz as TransferIcon,
  Inventory as InventoryIcon,
} from '@mui/icons-material';
import { auditLogAPI } from '../services/api';

interface AuditLog {
  id: number;
  user_id: number;
  username: string;
  user_display_name: string;
  action: string;
  entity_type: string;
  entity_id: number;
  entity_name: string;
  old_values: any;
  new_values: any;
  ip_address: string;
  user_agent: string;
  created_at: string;
}

interface AuditStats {
  last24h: { action: string; count: number }[];
  last7days: { date: string; action: string; count: number }[];
  activeUsers: { user_id: number; username: string; action_count: number }[];
  entityTypes: { entity_type: string; count: number }[];
}

const actionIcons: Record<string, React.ReactElement> = {
  CREATE: <AddIcon />,
  UPDATE: <EditIcon />,
  DELETE: <DeleteIcon />,
  LOGIN: <LoginIcon />,
  LOGOUT: <LogoutIcon />,
  VIEW: <ViewIcon />,
  EXPORT: <DownloadIcon />,
  IMPORT: <UploadIcon />,
  STOCK_IN: <InventoryIcon />,
  STOCK_OUT: <InventoryIcon />,
  TRANSFER: <TransferIcon />,
};

const actionColors: Record<string, 'success' | 'info' | 'warning' | 'error' | 'default'> = {
  CREATE: 'success',
  UPDATE: 'info',
  DELETE: 'error',
  LOGIN: 'success',
  LOGOUT: 'warning',
  VIEW: 'default',
  EXPORT: 'info',
  IMPORT: 'info',
  STOCK_IN: 'success',
  STOCK_OUT: 'warning',
  TRANSFER: 'info',
};

const actionLabels: Record<string, string> = {
  CREATE: 'Erstellt',
  UPDATE: 'Bearbeitet',
  DELETE: 'Gelöscht',
  LOGIN: 'Anmeldung',
  LOGOUT: 'Abmeldung',
  VIEW: 'Angezeigt',
  EXPORT: 'Exportiert',
  IMPORT: 'Importiert',
  STOCK_IN: 'Eingang',
  STOCK_OUT: 'Ausgang',
  TRANSFER: 'Transfer',
};

const entityLabels: Record<string, string> = {
  MATERIAL: 'Material',
  CABINET: 'Schrank',
  CATEGORY: 'Kategorie',
  COMPANY: 'Firma',
  USER: 'Benutzer',
  INTERVENTION: 'Intervention',
  UNIT: 'Abteilung',
};

const AuditLogs: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  
  // Filter
  const [actionFilter, setActionFilter] = useState<string>('');
  const [entityFilter, setEntityFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  
  // Filter Options
  const [actionOptions, setActionOptions] = useState<string[]>([]);
  const [entityOptions, setEntityOptions] = useState<string[]>([]);
  
  // Detail Dialog
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  
  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const response = await auditLogAPI.getAll({
        page,
        limit: 50,
        action: actionFilter || undefined,
        entity_type: entityFilter || undefined,
        search: searchQuery || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      });
      
      setLogs(response.data.data || []);
      setTotalPages(response.data.pagination?.totalPages || 1);
      setTotal(response.data.pagination?.total || 0);
    } catch (error) {
      console.error('Fehler beim Laden der Audit-Logs:', error);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [page, actionFilter, entityFilter, searchQuery, startDate, endDate]);
  
  const fetchStats = async () => {
    try {
      const response = await auditLogAPI.getStats();
      setStats(response.data);
    } catch (error) {
      console.error('Fehler beim Laden der Statistiken:', error);
    }
  };
  
  const fetchFilterOptions = async () => {
    try {
      const [actionsRes, entitiesRes] = await Promise.all([
        auditLogAPI.getActions(),
        auditLogAPI.getEntityTypes(),
      ]);
      setActionOptions(actionsRes.data || []);
      setEntityOptions(entitiesRes.data || []);
    } catch (error) {
      console.error('Fehler beim Laden der Filter-Optionen:', error);
    }
  };
  
  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);
  
  useEffect(() => {
    fetchStats();
    fetchFilterOptions();
  }, []);
  
  const handleViewDetails = (log: AuditLog) => {
    setSelectedLog(log);
    setDetailOpen(true);
  };
  
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };
  
  const columns: GridColDef[] = [
    {
      field: 'created_at',
      headerName: 'Zeitpunkt',
      width: 170,
      valueFormatter: (params) => formatDate(params.value),
    },
    {
      field: 'action',
      headerName: 'Aktion',
      width: 130,
      renderCell: (params) => (
        <Chip
          icon={actionIcons[params.value] || <EditIcon />}
          label={actionLabels[params.value] || params.value}
          color={actionColors[params.value] || 'default'}
          size="small"
        />
      ),
    },
    {
      field: 'entity_type',
      headerName: 'Typ',
      width: 120,
      valueFormatter: (params) => entityLabels[params.value] || params.value,
    },
    {
      field: 'entity_name',
      headerName: 'Objekt',
      width: 200,
      flex: 1,
    },
    {
      field: 'username',
      headerName: 'Benutzer',
      width: 150,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <PersonIcon fontSize="small" color="action" />
          {params.row.user_display_name || params.value}
        </Box>
      ),
    },
    {
      field: 'ip_address',
      headerName: 'IP-Adresse',
      width: 130,
    },
    {
      field: 'actions',
      headerName: 'Details',
      width: 80,
      sortable: false,
      renderCell: (params) => (
        <Tooltip title="Details anzeigen">
          <IconButton size="small" onClick={() => handleViewDetails(params.row)}>
            <ViewIcon />
          </IconButton>
        </Tooltip>
      ),
    },
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          Audit-Log
        </Typography>
        <Tooltip title="Aktualisieren">
          <IconButton onClick={() => { fetchLogs(); fetchStats(); }}>
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Statistik-Karten */}
      {stats && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Aktionen heute
                </Typography>
                <Typography variant="h4">
                  {stats.last24h.reduce((sum, item) => sum + item.count, 0)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Aktive Benutzer (7 Tage)
                </Typography>
                <Typography variant="h4">
                  {stats.activeUsers.length}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Häufigste Aktion
                </Typography>
                <Typography variant="h6">
                  {stats.last24h.length > 0 
                    ? actionLabels[stats.last24h[0]?.action] || stats.last24h[0]?.action
                    : '-'}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Gesamt Einträge
                </Typography>
                <Typography variant="h4">
                  {total}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Filter */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={6} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Aktion</InputLabel>
              <Select
                value={actionFilter}
                label="Aktion"
                onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
              >
                <MenuItem value="">Alle</MenuItem>
                {actionOptions.map((action) => (
                  <MenuItem key={action} value={action}>
                    {actionLabels[action] || action}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Typ</InputLabel>
              <Select
                value={entityFilter}
                label="Typ"
                onChange={(e) => { setEntityFilter(e.target.value); setPage(1); }}
              >
                <MenuItem value="">Alle</MenuItem>
                {entityOptions.map((entity) => (
                  <MenuItem key={entity} value={entity}>
                    {entityLabels[entity] || entity}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <TextField
              fullWidth
              size="small"
              label="Von"
              type="date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <TextField
              fullWidth
              size="small"
              label="Bis"
              type="date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} sm={12} md={4}>
            <TextField
              fullWidth
              size="small"
              label="Suche (Name, Benutzer)"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
              InputProps={{
                endAdornment: <FilterIcon color="action" />,
              }}
            />
          </Grid>
        </Grid>
      </Paper>

      {/* Logs-Tabelle */}
      <Paper sx={{ height: 600 }}>
        <DataGrid
          rows={logs}
          columns={columns}
          loading={loading}
          hideFooterPagination
          disableRowSelectionOnClick
          getRowId={(row) => row.id}
        />
      </Paper>

      {/* Pagination */}
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
        <Pagination
          count={totalPages}
          page={page}
          onChange={(_, value) => setPage(value)}
          color="primary"
        />
      </Box>

      {/* Detail-Dialog */}
      <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          Audit-Log Details
        </DialogTitle>
        <DialogContent dividers>
          {selectedLog && (
            <TableContainer>
              <Table size="small">
                <TableBody>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold', width: 150 }}>ID</TableCell>
                    <TableCell>{selectedLog.id}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>Zeitpunkt</TableCell>
                    <TableCell>{formatDate(selectedLog.created_at)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>Aktion</TableCell>
                    <TableCell>
                      <Chip
                        icon={actionIcons[selectedLog.action]}
                        label={actionLabels[selectedLog.action] || selectedLog.action}
                        color={actionColors[selectedLog.action] || 'default'}
                        size="small"
                      />
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>Entity-Typ</TableCell>
                    <TableCell>{entityLabels[selectedLog.entity_type] || selectedLog.entity_type}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>Entity-ID</TableCell>
                    <TableCell>{selectedLog.entity_id}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>Entity-Name</TableCell>
                    <TableCell>{selectedLog.entity_name}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>Benutzer</TableCell>
                    <TableCell>{selectedLog.user_display_name || selectedLog.username} (ID: {selectedLog.user_id})</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>IP-Adresse</TableCell>
                    <TableCell>{selectedLog.ip_address}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>User-Agent</TableCell>
                    <TableCell sx={{ wordBreak: 'break-all', fontSize: '0.75rem' }}>
                      {selectedLog.user_agent}
                    </TableCell>
                  </TableRow>
                  {selectedLog.old_values && (
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>Alte Werte</TableCell>
                      <TableCell>
                        <Paper variant="outlined" sx={{ p: 1, bgcolor: '#fff3e0' }}>
                          <pre style={{ margin: 0, fontSize: '0.75rem', whiteSpace: 'pre-wrap' }}>
                            {JSON.stringify(
                              typeof selectedLog.old_values === 'string' 
                                ? JSON.parse(selectedLog.old_values) 
                                : selectedLog.old_values, 
                              null, 2
                            )}
                          </pre>
                        </Paper>
                      </TableCell>
                    </TableRow>
                  )}
                  {selectedLog.new_values && (
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>Neue Werte</TableCell>
                      <TableCell>
                        <Paper variant="outlined" sx={{ p: 1, bgcolor: '#e8f5e9' }}>
                          <pre style={{ margin: 0, fontSize: '0.75rem', whiteSpace: 'pre-wrap' }}>
                            {JSON.stringify(
                              typeof selectedLog.new_values === 'string' 
                                ? JSON.parse(selectedLog.new_values) 
                                : selectedLog.new_values, 
                              null, 2
                            )}
                          </pre>
                        </Paper>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailOpen(false)}>Schließen</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AuditLogs;
