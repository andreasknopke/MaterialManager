import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  Tabs,
  Tab,
  Alert,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  SwapVert as SwapVertIcon,
  Person as PersonIcon,
  Inventory as InventoryIcon,
  Refresh as RefreshIcon,
  Euro as EuroIcon,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { de } from 'date-fns/locale';
import { format, subDays } from 'date-fns';
import { statisticsAPI, unitAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ChartTooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';

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

interface Transaction {
  id: number;
  material_id: number;
  material_name: string;
  article_number: string;
  transaction_type: 'in' | 'out' | 'adjustment' | 'expired';
  quantity: number;
  previous_stock: number;
  new_stock: number;
  reference_number: string;
  notes: string;
  performed_by: string;
  transaction_date: string;
  unit_name: string;
  cabinet_name: string;
  category_name: string;
}

interface Summary {
  total_in_count: number;
  total_out_count: number;
  total_in_quantity: number;
  total_out_quantity: number;
  total_in_cost: number;
  total_out_cost: number;
  materials_affected: number;
  active_users: number;
  total_transactions: number;
}

interface MaterialStats {
  material_id: number;
  material_name: string;
  article_number: string;
  current_stock: number;
  min_stock: number;
  cost: number | null;
  unit_name: string;
  cabinet_name: string;
  category_name: string;
  max_stock_ever: number;
  min_stock_ever: number;
  total_in: number;
  total_out: number;
  transaction_count: number;
  last_transaction_date: string;
  current_stock_value: number;
  total_in_value: number;
  total_out_value: number;
}

interface UserActivity {
  user_id: number;
  user_name: string;
  total_transactions: number;
  in_count: number;
  out_count: number;
  total_in_quantity: number;
  total_out_quantity: number;
  first_transaction: string;
  last_transaction: string;
}

interface Unit {
  id: number;
  name: string;
}

const Statistics: React.FC = () => {
  const { user } = useAuth();
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState<Date | null>(subDays(new Date(), 30));
  const [endDate, setEndDate] = useState<Date | null>(new Date());
  const [selectedUnit, setSelectedUnit] = useState<string>('');
  const [units, setUnits] = useState<Unit[]>([]);
  
  // Data states
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [topMaterials, setTopMaterials] = useState<any[]>([]);
  const [dailyStats, setDailyStats] = useState<any[]>([]);
  const [monthlyStats, setMonthlyStats] = useState<any[]>([]);
  const [materialStats, setMaterialStats] = useState<MaterialStats[]>([]);
  const [userActivity, setUserActivity] = useState<UserActivity[]>([]);

  useEffect(() => {
    loadUnits();
    loadData();
  }, []);

  useEffect(() => {
    loadData();
  }, [startDate, endDate, selectedUnit]);

  const loadUnits = async () => {
    try {
      const response = await unitAPI.getAll();
      setUnits(response.data || []);
    } catch (error) {
      console.error('Fehler beim Laden der Departments:', error);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (startDate) params.startDate = format(startDate, 'yyyy-MM-dd');
      if (endDate) params.endDate = format(endDate, 'yyyy-MM-dd');
      if (selectedUnit && user?.isRoot) params.unitId = selectedUnit;

      const [transRes, summaryRes, dailyRes, monthlyRes, materialRes, userRes] = await Promise.all([
        statisticsAPI.getTransactions(params),
        statisticsAPI.getSummary(params),
        statisticsAPI.getDaily(params),
        statisticsAPI.getMonthly({ year: new Date().getFullYear(), unitId: selectedUnit || undefined }),
        statisticsAPI.getMaterialStats({ unitId: selectedUnit || undefined }),
        statisticsAPI.getUserActivity(params),
      ]);

      setTransactions(transRes.data || []);
      setSummary(summaryRes.data?.summary || null);
      setTopMaterials(summaryRes.data?.topMaterials || []);
      setDailyStats(processedDailyStats(dailyRes.data || []));
      setMonthlyStats(monthlyRes.data || []);
      setMaterialStats(materialRes.data || []);
      setUserActivity(userRes.data || []);
    } catch (error) {
      console.error('Fehler beim Laden der Statistiken:', error);
    } finally {
      setLoading(false);
    }
  };

  // Process daily stats for chart
  const processedDailyStats = (data: any[]) => {
    const dateMap: { [key: string]: { date: string; in: number; out: number } } = {};
    
    data.forEach((item: any) => {
      const date = item.date;
      if (!dateMap[date]) {
        dateMap[date] = { date, in: 0, out: 0 };
      }
      if (item.transaction_type === 'in') {
        dateMap[date].in = item.total_quantity;
      } else if (item.transaction_type === 'out') {
        dateMap[date].out = item.total_quantity;
      }
    });
    
    return Object.values(dateMap).sort((a, b) => a.date.localeCompare(b.date));
  };

  const getTransactionTypeLabel = (type: string) => {
    const labels: { [key: string]: { label: string; color: 'success' | 'error' | 'warning' | 'info' } } = {
      in: { label: 'Eingang', color: 'success' },
      out: { label: 'Ausgang', color: 'error' },
      adjustment: { label: 'Korrektur', color: 'warning' },
      expired: { label: 'Abgelaufen', color: 'info' },
    };
    return labels[type] || { label: type, color: 'info' };
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    return format(new Date(dateStr), 'dd.MM.yyyy HH:mm', { locale: de });
  };

  const formatDateShort = (dateStr: string) => {
    if (!dateStr) return '-';
    return format(new Date(dateStr), 'dd.MM.yyyy', { locale: de });
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4">
            Statistiken & Protokoll
          </Typography>
          <Tooltip title="Aktualisieren">
            <IconButton onClick={loadData} disabled={loading}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>

        {/* Filter Section */}
        <Paper sx={{ p: 2, mb: 3 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={6} md={3}>
              <DatePicker
                label="Von"
                value={startDate}
                onChange={setStartDate}
                slotProps={{ textField: { fullWidth: true, size: 'small' } }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <DatePicker
                label="Bis"
                value={endDate}
                onChange={setEndDate}
                slotProps={{ textField: { fullWidth: true, size: 'small' } }}
              />
            </Grid>
            {user?.isRoot && (
              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Department</InputLabel>
                  <Select
                    value={selectedUnit}
                    onChange={(e) => setSelectedUnit(e.target.value)}
                    label="Department"
                  >
                    <MenuItem value="">Alle Departments</MenuItem>
                    {units.map((unit) => (
                      <MenuItem key={unit.id} value={unit.id}>
                        {unit.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            )}
          </Grid>
        </Paper>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            {/* Summary Cards */}
            <Grid container spacing={3} sx={{ mb: 3 }}>
              <Grid item xs={12} sm={6} md={2.4}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <TrendingUpIcon color="success" sx={{ mr: 1 }} />
                      <Typography color="text.secondary" variant="body2">
                        Eingänge
                      </Typography>
                    </Box>
                    <Typography variant="h4" color="success.main">
                      {summary?.total_in_quantity || 0}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {summary?.total_in_count || 0} Buchungen
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={2.4}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <TrendingDownIcon color="error" sx={{ mr: 1 }} />
                      <Typography color="text.secondary" variant="body2">
                        Ausgänge
                      </Typography>
                    </Box>
                    <Typography variant="h4" color="error.main">
                      {summary?.total_out_quantity || 0}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {summary?.total_out_count || 0} Buchungen
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={2.4}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <EuroIcon color="warning" sx={{ mr: 1 }} />
                      <Typography color="text.secondary" variant="body2">
                        Kosten (Ausgänge)
                      </Typography>
                    </Box>
                    <Typography variant="h4" color="warning.main">
                      {(summary?.total_out_cost || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Eingänge: {(summary?.total_in_cost || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={2.4}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <InventoryIcon color="primary" sx={{ mr: 1 }} />
                      <Typography color="text.secondary" variant="body2">
                        Materialien bewegt
                      </Typography>
                    </Box>
                    <Typography variant="h4" color="primary.main">
                      {summary?.materials_affected || 0}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {summary?.total_transactions || 0} Transaktionen gesamt
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={2.4}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <PersonIcon color="info" sx={{ mr: 1 }} />
                      <Typography color="text.secondary" variant="body2">
                        Aktive Benutzer
                      </Typography>
                    </Box>
                    <Typography variant="h4" color="info.main">
                      {summary?.active_users || 0}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      im Zeitraum
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            {/* Tabs */}
            <Paper sx={{ mt: 3 }}>
              <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)}>
                <Tab label="Transaktionsprotokoll" />
                <Tab label="Tägliche Bewegungen" />
                <Tab label="Monatliche Übersicht" />
                <Tab label="Material-Statistik" />
                <Tab label="Benutzer-Aktivität" />
              </Tabs>

              {/* Tab 0: Transaktionsprotokoll */}
              <TabPanel value={tabValue} index={0}>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Datum</TableCell>
                        <TableCell>Typ</TableCell>
                        <TableCell>Material</TableCell>
                        <TableCell align="right">Menge</TableCell>
                        <TableCell align="right">Bestand vorher</TableCell>
                        <TableCell align="right">Bestand nachher</TableCell>
                        <TableCell>Benutzer</TableCell>
                        <TableCell>Notiz</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {transactions.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} align="center">
                            Keine Transaktionen im gewählten Zeitraum
                          </TableCell>
                        </TableRow>
                      ) : (
                        transactions.map((t) => {
                          const typeInfo = getTransactionTypeLabel(t.transaction_type);
                          return (
                            <TableRow key={t.id} hover>
                              <TableCell>{formatDate(t.transaction_date)}</TableCell>
                              <TableCell>
                                <Chip
                                  label={typeInfo.label}
                                  color={typeInfo.color}
                                  size="small"
                                />
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2" fontWeight="medium">
                                  {t.material_name}
                                </Typography>
                                {t.article_number && (
                                  <Typography variant="caption" color="text.secondary">
                                    {t.article_number}
                                  </Typography>
                                )}
                              </TableCell>
                              <TableCell align="right">
                                <Typography
                                  color={t.transaction_type === 'in' ? 'success.main' : 'error.main'}
                                  fontWeight="medium"
                                >
                                  {t.transaction_type === 'in' ? '+' : '-'}{t.quantity}
                                </Typography>
                              </TableCell>
                              <TableCell align="right">{t.previous_stock}</TableCell>
                              <TableCell align="right">{t.new_stock}</TableCell>
                              <TableCell>{t.performed_by || '-'}</TableCell>
                              <TableCell>{t.notes || '-'}</TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </TabPanel>

              {/* Tab 1: Tägliche Bewegungen */}
              <TabPanel value={tabValue} index={1}>
                {dailyStats.length > 0 ? (
                  <Box sx={{ height: 400 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={dailyStats}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="date" 
                          tickFormatter={(value) => format(new Date(value), 'dd.MM', { locale: de })}
                        />
                        <YAxis />
                        <ChartTooltip 
                          labelFormatter={(value) => format(new Date(value), 'dd.MM.yyyy', { locale: de })}
                        />
                        <Legend />
                        <Line 
                          type="monotone" 
                          dataKey="in" 
                          name="Eingänge" 
                          stroke="#4caf50" 
                          strokeWidth={2}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="out" 
                          name="Ausgänge" 
                          stroke="#f44336" 
                          strokeWidth={2}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </Box>
                ) : (
                  <Alert severity="info">Keine Daten im gewählten Zeitraum</Alert>
                )}
              </TabPanel>

              {/* Tab 2: Monatliche Übersicht */}
              <TabPanel value={tabValue} index={2}>
                {monthlyStats.length > 0 ? (
                  <>
                    <Box sx={{ height: 400, mb: 3 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={monthlyStats}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis 
                            dataKey="month"
                            tickFormatter={(value) => {
                              const monthNames = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 
                                                  'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
                              return monthNames[value - 1] || value;
                            }}
                          />
                          <YAxis />
                          <ChartTooltip />
                          <Legend />
                          <Bar dataKey="total_in" name="Eingänge" fill="#4caf50" />
                          <Bar dataKey="total_out" name="Ausgänge" fill="#f44336" />
                        </BarChart>
                      </ResponsiveContainer>
                    </Box>
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Monat</TableCell>
                            <TableCell align="right">Eingänge</TableCell>
                            <TableCell align="right">Ausgänge</TableCell>
                            <TableCell align="right">Buchungen Ein</TableCell>
                            <TableCell align="right">Buchungen Aus</TableCell>
                            <TableCell align="right">Materialien betroffen</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {monthlyStats.map((m: any) => {
                            const monthNames = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 
                                              'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
                            return (
                              <TableRow key={`${m.year}-${m.month}`}>
                                <TableCell>{monthNames[m.month - 1]} {m.year}</TableCell>
                                <TableCell align="right" sx={{ color: 'success.main' }}>+{m.total_in || 0}</TableCell>
                                <TableCell align="right" sx={{ color: 'error.main' }}>-{m.total_out || 0}</TableCell>
                                <TableCell align="right">{m.in_count || 0}</TableCell>
                                <TableCell align="right">{m.out_count || 0}</TableCell>
                                <TableCell align="right">{m.materials_affected || 0}</TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </>
                ) : (
                  <Alert severity="info">Keine Daten für das aktuelle Jahr</Alert>
                )}
              </TabPanel>

              {/* Tab 3: Material-Statistik */}
              <TabPanel value={tabValue} index={3}>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Material</TableCell>
                        <TableCell>Kategorie</TableCell>
                        <TableCell align="right">Bestand</TableCell>
                        <TableCell align="right">Kosten/Stk</TableCell>
                        <TableCell align="right">Bestandswert</TableCell>
                        <TableCell align="right">Höchststand</TableCell>
                        <TableCell align="right">Tiefststand</TableCell>
                        <TableCell align="right">Ges. Eingänge</TableCell>
                        <TableCell align="right">Ges. Ausgänge</TableCell>
                        <TableCell align="right">Ausgangswert</TableCell>
                        <TableCell>Letzte Bewegung</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {materialStats.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={11} align="center">
                            Keine Materialien vorhanden
                          </TableCell>
                        </TableRow>
                      ) : (
                        materialStats.map((m) => (
                          <TableRow key={m.material_id} hover>
                            <TableCell>
                              <Typography variant="body2" fontWeight="medium">
                                {m.material_name}
                              </Typography>
                              {m.article_number && (
                                <Typography variant="caption" color="text.secondary">
                                  {m.article_number}
                                </Typography>
                              )}
                            </TableCell>
                            <TableCell>{m.category_name || '-'}</TableCell>
                            <TableCell align="right">
                              <Chip 
                                label={m.current_stock} 
                                size="small"
                                color={m.current_stock <= (m.min_stock || 0) ? 'error' : 'default'}
                              />
                            </TableCell>
                            <TableCell align="right">
                              {m.cost ? `${Number(m.cost).toFixed(2)} €` : '-'}
                            </TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'medium' }}>
                              {m.current_stock_value ? `${Number(m.current_stock_value).toFixed(2)} €` : '-'}
                            </TableCell>
                            <TableCell align="right">{m.max_stock_ever || m.current_stock}</TableCell>
                            <TableCell align="right">{m.min_stock_ever || 0}</TableCell>
                            <TableCell align="right" sx={{ color: 'success.main' }}>
                              +{m.total_in || 0}
                            </TableCell>
                            <TableCell align="right" sx={{ color: 'error.main' }}>
                              -{m.total_out || 0}
                            </TableCell>
                            <TableCell align="right" sx={{ color: 'error.main' }}>
                              {m.total_out_value ? `${Number(m.total_out_value).toFixed(2)} €` : '-'}
                            </TableCell>
                            <TableCell>
                              {m.last_transaction_date ? formatDateShort(m.last_transaction_date) : '-'}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </TabPanel>

              {/* Tab 4: Benutzer-Aktivität */}
              <TabPanel value={tabValue} index={4}>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Benutzer</TableCell>
                        <TableCell align="right">Transaktionen</TableCell>
                        <TableCell align="right">Eingänge</TableCell>
                        <TableCell align="right">Ausgänge</TableCell>
                        <TableCell align="right">Menge Eingang</TableCell>
                        <TableCell align="right">Menge Ausgang</TableCell>
                        <TableCell>Erste Buchung</TableCell>
                        <TableCell>Letzte Buchung</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {userActivity.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} align="center">
                            Keine Benutzeraktivität im gewählten Zeitraum
                          </TableCell>
                        </TableRow>
                      ) : (
                        userActivity.map((u, idx) => (
                          <TableRow key={u.user_id || idx} hover>
                            <TableCell>
                              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                <PersonIcon sx={{ mr: 1, color: 'text.secondary' }} fontSize="small" />
                                {u.user_name}
                              </Box>
                            </TableCell>
                            <TableCell align="right">
                              <Chip label={u.total_transactions} size="small" />
                            </TableCell>
                            <TableCell align="right">{u.in_count}</TableCell>
                            <TableCell align="right">{u.out_count}</TableCell>
                            <TableCell align="right" sx={{ color: 'success.main' }}>
                              +{u.total_in_quantity || 0}
                            </TableCell>
                            <TableCell align="right" sx={{ color: 'error.main' }}>
                              -{u.total_out_quantity || 0}
                            </TableCell>
                            <TableCell>{formatDateShort(u.first_transaction)}</TableCell>
                            <TableCell>{formatDateShort(u.last_transaction)}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </TabPanel>
            </Paper>
          </>
        )}
      </Box>
    </LocalizationProvider>
  );
};

export default Statistics;
