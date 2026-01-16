import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  Box,
  Button,
  Typography,
  Paper,
  TextField,
  IconButton,
  Chip,
  Alert,
  FormControlLabel,
  Checkbox,
  Grid,
  MenuItem,
  Collapse,
  Badge,
  Tooltip,
} from '@mui/material';
import { DataGrid, GridColDef, GridColumnVisibilityModel } from '@mui/x-data-grid';
import { 
  Add as AddIcon, 
  Edit as EditIcon, 
  Delete as DeleteIcon,
  FilterList as FilterListIcon,
  Clear as ClearIcon,
  ShoppingCart as ShoppingCartIcon,
  ViewColumn as ViewColumnIcon,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { materialAPI, categoryAPI, companyAPI, cabinetAPI, shapeAPI } from '../services/api';

// Guidewire-Acceptance Optionen
const GUIDEWIRE_OPTIONS = ['0.014in', '0.018in', '0.032in', '0.035in', '0.038in'];

// Hilfsfunktion: Numerischen Filter mit Operatoren parsen
// Unterstützt: >, >=, <, <=, exakter Wert, und Bereiche (z.B. "8-10")
const matchesNumericFilter = (value: string | null | undefined, filterExpr: string): boolean => {
  if (!filterExpr || filterExpr.trim() === '') return true;
  if (!value) return false;
  
  // Extrahiere Zahl aus dem Wert (z.B. "12mm" -> 12, "5.5" -> 5.5)
  const numMatch = value.match(/[\d.]+/);
  if (!numMatch) return false;
  const numValue = parseFloat(numMatch[0]);
  if (isNaN(numValue)) return false;
  
  const expr = filterExpr.trim();
  
  // Bereich: z.B. "8-10" oder "5.5-7.5"
  const rangeMatch = expr.match(/^([\d.]+)\s*-\s*([\d.]+)$/);
  if (rangeMatch) {
    const min = parseFloat(rangeMatch[1]);
    const max = parseFloat(rangeMatch[2]);
    return numValue >= min && numValue <= max;
  }
  
  // Operatoren: >=, <=, >, <
  if (expr.startsWith('>=')) {
    const threshold = parseFloat(expr.slice(2).trim());
    return !isNaN(threshold) && numValue >= threshold;
  }
  if (expr.startsWith('<=')) {
    const threshold = parseFloat(expr.slice(2).trim());
    return !isNaN(threshold) && numValue <= threshold;
  }
  if (expr.startsWith('>')) {
    const threshold = parseFloat(expr.slice(1).trim());
    return !isNaN(threshold) && numValue > threshold;
  }
  if (expr.startsWith('<')) {
    const threshold = parseFloat(expr.slice(1).trim());
    return !isNaN(threshold) && numValue < threshold;
  }
  
  // Exakte Übereinstimmung (numerisch)
  const filterNum = parseFloat(expr);
  if (!isNaN(filterNum)) {
    return numValue === filterNum;
  }
  
  // Fallback: String-Vergleich
  return value.toLowerCase() === expr.toLowerCase();
};

interface FilterState {
  category_id: string;
  company_id: string;
  cabinet_id: string;
  shape_id: string;
  french_size: string;
  device_length: string;
  shaft_length: string;
  device_diameter: string;
  guidewire_acceptance: string;
  is_consignment: string;
}

const emptyFilters: FilterState = {
  category_id: '',
  company_id: '',
  cabinet_id: '',
  shape_id: '',
  french_size: '',
  device_length: '',
  shaft_length: '',
  device_diameter: '',
  guidewire_acceptance: '',
  is_consignment: '',
};

// SessionStorage Key für Filter-Persistenz
const MATERIALS_FILTER_KEY = 'materials_filter_state';

// LocalStorage Key für Spalten-Einstellungen (benutzer-spezifisch)
const getColumnsSettingsKey = (userId: number) => `materials_columns_settings_${userId}`;

// Standard-Spaltenreihenfolge
const DEFAULT_COLUMN_ORDER = [
  'id', 'name', 'article_number', 'description', 'category_name', 'company_name', 
  'cabinet_name', 'compartment_name', 'location_in_cabinet', 'size', 'unit',
  'current_stock', 'min_stock', 'pending_orders', 'cost', 'expiry_date', 'lot_number',
  'shape_name', 'french_size', 'device_length', 'shaft_length', 'device_diameter', 
  'guidewire_acceptance', 'notes', 'stock_status', 'actions'
];

// Standard-Sichtbarkeit
const DEFAULT_COLUMN_VISIBILITY: GridColumnVisibilityModel = {
  id: false,
  description: false,
  category_name: false,
  company_name: false,
  cabinet_name: false,
  location_in_cabinet: false,
  size: false,
  unit: false,
  min_stock: false,
  cost: false,
  expiry_date: false,
  lot_number: false,
  shape_name: false,
  french_size: false,
  device_length: false,
  shaft_length: false,
  device_diameter: false,
  guidewire_acceptance: false,
  notes: false,
};

interface ColumnSettings {
  order: string[];
  visibility: GridColumnVisibilityModel;
}

// Gespeicherte Filter aus SessionStorage laden
const loadSavedFilters = (): { 
  searchTerm: string; 
  filters: FilterState; 
  hideZeroStock: boolean; 
  groupIdentical: boolean;
  showFilters: boolean;
  activeFilter: string | null;
} | null => {
  try {
    const saved = sessionStorage.getItem(MATERIALS_FILTER_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('Fehler beim Laden der gespeicherten Filter:', e);
  }
  return null;
};

const Materials: React.FC = () => {
  const { user } = useAuth();
  
  // Gespeicherte Filter laden
  const savedFilters = loadSavedFilters();
  
  // Spalteneinstellungen laden
  const loadColumnSettings = useCallback((): ColumnSettings => {
    if (!user?.id) return { order: DEFAULT_COLUMN_ORDER, visibility: DEFAULT_COLUMN_VISIBILITY };
    try {
      const saved = localStorage.getItem(getColumnsSettingsKey(user.id));
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          order: parsed.order || DEFAULT_COLUMN_ORDER,
          visibility: { ...DEFAULT_COLUMN_VISIBILITY, ...parsed.visibility },
        };
      }
    } catch (e) {
      console.error('Fehler beim Laden der Spalteneinstellungen:', e);
    }
    return { order: DEFAULT_COLUMN_ORDER, visibility: DEFAULT_COLUMN_VISIBILITY };
  }, [user?.id]);
  
  const [columnSettings, setColumnSettings] = useState<ColumnSettings>(() => loadColumnSettings());
  
  const [materials, setMaterials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState(savedFilters?.searchTerm || '');
  const [activeFilter, setActiveFilter] = useState<string | null>(savedFilters?.activeFilter || null);
  const [hideZeroStock, setHideZeroStock] = useState(savedFilters?.hideZeroStock ?? true);
  const [groupIdentical, setGroupIdentical] = useState(savedFilters?.groupIdentical ?? true);
  const [showFilters, setShowFilters] = useState(savedFilters?.showFilters ?? false);
  const [filters, setFilters] = useState<FilterState>(savedFilters?.filters || emptyFilters);
  
  // Dropdown-Daten für Filter
  const [categories, setCategories] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [cabinets, setCabinets] = useState<any[]>([]);
  const [shapes, setShapes] = useState<any[]>([]);
  
  const navigate = useNavigate();
  const location = useLocation();

  // Spalteneinstellungen in localStorage speichern bei Änderungen
  useEffect(() => {
    if (user?.id) {
      localStorage.setItem(getColumnsSettingsKey(user.id), JSON.stringify(columnSettings));
    }
  }, [columnSettings, user?.id]);

  // Filter in SessionStorage speichern bei Änderungen
  useEffect(() => {
    const filterState = {
      searchTerm,
      filters,
      hideZeroStock,
      groupIdentical,
      showFilters,
      activeFilter,
    };
    sessionStorage.setItem(MATERIALS_FILTER_KEY, JSON.stringify(filterState));
  }, [searchTerm, filters, hideZeroStock, groupIdentical, showFilters, activeFilter]);

  useEffect(() => {
    const filter = location.state?.filter;
    if (filter) {
      setActiveFilter(filter);
    }
    fetchMaterials();
    fetchFilterData();
  }, [location.state]);

  const fetchFilterData = async () => {
    try {
      const [catRes, compRes, cabRes, shapeRes] = await Promise.all([
        categoryAPI.getAll(),
        companyAPI.getAll(),
        cabinetAPI.getAll(),
        shapeAPI.getAll(),
      ]);
      setCategories(catRes.data || []);
      setCompanies(compRes.data || []);
      setCabinets(cabRes.data || []);
      setShapes(shapeRes.data || []);
    } catch (error) {
      console.error('Fehler beim Laden der Filterdaten:', error);
    }
  };

  const fetchMaterials = async () => {
    try {
      let response;
      const filter = location.state?.filter;
      
      if (filter === 'lowStock') {
        response = await materialAPI.getLowStock();
      } else if (filter === 'expiring') {
        response = await materialAPI.getExpiring();
      } else {
        response = await materialAPI.getAll();
      }
      
      console.log('API Response:', response.data);
      // Sicherstellen, dass wir ein Array haben
      const data = Array.isArray(response.data) ? response.data : [];
      setMaterials(data);
    } catch (error) {
      console.error('Fehler beim Laden der Materialien:', error);
      setMaterials([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Material wirklich deaktivieren?')) {
      try {
        await materialAPI.delete(id);
        fetchMaterials();
      } catch (error) {
        console.error('Fehler beim Löschen:', error);
      }
    }
  };

  const getStatusChip = (status: string) => {
    switch (status) {
      case 'LOW':
        return <Chip label="Niedriger Bestand" color="warning" size="small" />;
      case 'EXPIRING':
        return <Chip label="Läuft ab" color="error" size="small" />;
      default:
        return <Chip label="OK" color="success" size="small" />;
    }
  };

  // Alle verfügbaren Spalten definieren
  const allColumns: GridColDef[] = useMemo(() => [
    { field: 'id', headerName: 'ID', width: 70 },
    { 
      field: 'name', 
      headerName: 'Bezeichnung', 
      minWidth: 150, 
      flex: 1,
      renderCell: (params) => {
        return (
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            width: '100%',
            backgroundColor: params.row.is_consignment ? 'rgba(211, 47, 47, 0.1)' : 'transparent',
            borderLeft: params.row.is_consignment ? '4px solid #d32f2f' : 'none',
            pl: params.row.is_consignment ? 1 : 0,
            ml: params.row.is_consignment ? -1 : 0,
          }}>
            {params.row.name}
            {params.row.is_consignment ? (
              <Chip 
                label="K" 
                size="small" 
                color="error" 
                sx={{ ml: 1, height: 18, fontSize: '0.7rem', minWidth: 20 }}
                title="Konsignationsware"
              />
            ) : (
              <Chip 
                label="B" 
                size="small" 
                color="success" 
                sx={{ ml: 1, height: 18, fontSize: '0.7rem', minWidth: 20 }}
                title="Besitzware"
              />
            )}
            {groupIdentical && params.row.grouped_count > 1 && (
              <Chip 
                label={`${params.row.grouped_count}x`} 
                size="small" 
                color="info" 
                sx={{ ml: 1, height: 18, fontSize: '0.7rem' }}
              />
            )}
          </Box>
        );
      },
    },
    { field: 'article_number', headerName: 'GTIN/Art.Nr.', width: 130 },
    { field: 'description', headerName: 'Beschreibung', width: 200 },
    { field: 'category_name', headerName: 'Kategorie', width: 120 },
    { field: 'company_name', headerName: 'Firma', width: 120 },
    { 
      field: 'cabinet_name', 
      headerName: 'Schrank', 
      width: 120,
      valueGetter: (params) => groupIdentical && params.row.locations ? params.row.locations : params.value,
    },
    { field: 'compartment_name', headerName: 'Fach', width: 80 },
    { field: 'location_in_cabinet', headerName: 'Lagerort', width: 100 },
    { field: 'size', headerName: 'Einh./Pkg.', width: 80 },
    { field: 'unit', headerName: 'Einheit', width: 80 },
    { 
      field: 'current_stock', 
      headerName: 'Bestand', 
      width: 90, 
      type: 'number',
      renderCell: (params) => (
        <Chip 
          label={params.value} 
          size="small" 
          color={params.value <= 0 ? 'error' : params.value <= (params.row.min_stock || 0) ? 'warning' : 'default'}
        />
      ),
    },
    { field: 'min_stock', headerName: 'Min.', width: 70, type: 'number' },
    {
      field: 'pending_orders',
      headerName: 'Bestellt',
      width: 80,
      type: 'number',
      renderCell: (params) => {
        const count = Number(params.value) || 0;
        if (count > 0) {
          return (
            <Chip
              icon={<ShoppingCartIcon sx={{ fontSize: 14 }} />}
              label={count}
              size="small"
              color="success"
              sx={{ height: 22 }}
            />
          );
        }
        return <Typography variant="body2" color="text.secondary">-</Typography>;
      },
    },
    {
      field: 'cost',
      headerName: 'Kosten',
      width: 90,
      type: 'number',
      valueFormatter: (params) => {
        return params.value ? `${Number(params.value).toFixed(2)} €` : '-';
      },
    },
    {
      field: 'expiry_date',
      headerName: 'Verfallsdatum',
      width: 110,
      valueFormatter: (params) => {
        return params.value ? new Date(params.value).toLocaleDateString('de-DE') : '-';
      },
    },
    { field: 'lot_number', headerName: 'LOT/Charge', width: 110 },
    // Device-Eigenschaften
    { field: 'shape_name', headerName: 'Shape/Form', width: 100 },
    { field: 'french_size', headerName: 'French-Size', width: 90 },
    { field: 'device_length', headerName: 'Device-Länge', width: 100 },
    { field: 'shaft_length', headerName: 'Schaftlänge', width: 100 },
    { field: 'device_diameter', headerName: 'Durchmesser', width: 100 },
    { field: 'guidewire_acceptance', headerName: 'Guidewire', width: 90 },
    { 
      field: 'notes', 
      headerName: 'Notizen', 
      width: 150,
      renderCell: (params) => (
        <Tooltip title={params.value || ''} placement="top">
          <Typography variant="body2" noWrap sx={{ maxWidth: 140 }}>
            {params.value || '-'}
          </Typography>
        </Tooltip>
      ),
    },
    {
      field: 'stock_status',
      headerName: 'Status',
      width: 120,
      renderCell: (params) => getStatusChip(params.value),
    },
    {
      field: 'actions',
      headerName: 'Aktionen',
      width: 100,
      sortable: false,
      disableColumnMenu: true,
      renderCell: (params) => (
        <>
          <IconButton
            size="small"
            onClick={() => navigate(`/materials/${params.row.id}`)}
          >
            <EditIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            onClick={() => handleDelete(params.row.id)}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </>
      ),
    },
  ], [groupIdentical, navigate]);

  // Spalten nach gespeicherter Reihenfolge sortieren
  const columns = useMemo(() => {
    const columnMap = new Map(allColumns.map(col => [col.field, col]));
    const orderedColumns: GridColDef[] = [];
    
    // Erst die Spalten in der gespeicherten Reihenfolge
    for (const field of columnSettings.order) {
      const col = columnMap.get(field);
      if (col) {
        orderedColumns.push(col);
        columnMap.delete(field);
      }
    }
    
    // Dann alle neuen Spalten, die noch nicht in der Reihenfolge sind
    columnMap.forEach(col => orderedColumns.push(col));
    
    return orderedColumns;
  }, [allColumns, columnSettings.order]);

  // Handler für Spaltenreihenfolge-Änderung
  const handleColumnOrderChange = useCallback(() => {
    // Das DataGrid gibt uns keine direkte Info über die neue Reihenfolge
    // Wir müssen sie aus dem DOM oder den Column-API auslesen
    // Da MUI DataGrid Community keine onColumnOrderChange hat,
    // verwenden wir stattdessen die Spalten-Menü Funktion
  }, []);

  // Zähle aktive Filter
  const activeFilterCount = Object.values(filters).filter(v => v !== '').length;

  const handleFilterChange = (field: keyof FilterState) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setFilters({ ...filters, [field]: e.target.value });
  };

  const clearFilters = () => {
    setFilters(emptyFilters);
  };

  const filteredMaterials = materials.filter((material: any) => {
    // Textsuche
    const matchesSearch = searchTerm === '' || 
      material.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      material.category_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      material.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      material.article_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      material.lot_number?.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Bestand-Filter
    const hasStock = hideZeroStock ? material.current_stock > 0 : true;
    
    // Dropdown-Filter
    const matchesCategory = filters.category_id === '' || String(material.category_id) === filters.category_id;
    const matchesCompany = filters.company_id === '' || String(material.company_id) === filters.company_id;
    const matchesCabinet = filters.cabinet_id === '' || String(material.cabinet_id) === filters.cabinet_id;
    const matchesShape = filters.shape_id === '' || String(material.shape_id) === filters.shape_id;
    const matchesFrenchSize = filters.french_size === '' || 
      (material.french_size && material.french_size.toLowerCase() === filters.french_size.toLowerCase());
    
    // Numerische Filter mit Operator-Unterstützung (>, >=, <, <=, 8-10)
    const matchesDeviceLength = matchesNumericFilter(material.device_length, filters.device_length);
    const matchesShaftLength = matchesNumericFilter(material.shaft_length, filters.shaft_length);
    const matchesDeviceDiameter = matchesNumericFilter(material.device_diameter, filters.device_diameter);
    
    const matchesGuidewire = filters.guidewire_acceptance === '' || material.guidewire_acceptance === filters.guidewire_acceptance;
    const matchesConsignment = filters.is_consignment === '' || 
      (filters.is_consignment === 'true' ? material.is_consignment : !material.is_consignment);
    
    return matchesSearch && hasStock && matchesCategory && matchesCompany && matchesCabinet && 
           matchesShape && matchesFrenchSize && matchesDeviceLength && matchesShaftLength && 
           matchesDeviceDiameter && matchesGuidewire && matchesConsignment;
  });

  // Gruppiere identische Materialien (gleiche GTIN oder gleicher Name)
  const groupedMaterials = React.useMemo(() => {
    if (!groupIdentical) return filteredMaterials;

    const groups = new Map<string, any>();
    
    filteredMaterials.forEach((material: any) => {
      // Gruppierungsschlüssel: GTIN wenn vorhanden, sonst Name
      const key = material.article_number || material.name;
      
      if (groups.has(key)) {
        const existing = groups.get(key);
        existing.current_stock += material.current_stock || 0;
        existing.grouped_count += 1;
        existing.grouped_ids.push(material.id);
        // Behalte die niedrigste min_stock
        if (material.min_stock > 0 && (existing.min_stock === 0 || material.min_stock < existing.min_stock)) {
          existing.min_stock = material.min_stock;
        }
        // Sammle alle Standorte
        if (material.cabinet_name) {
          existing.locations.add(material.cabinet_name);
        }
        // Frühestes Verfallsdatum behalten für EXPIRING Status
        if (material.expiry_date && (!existing.expiry_date || new Date(material.expiry_date) < new Date(existing.expiry_date))) {
          existing.expiry_date = material.expiry_date;
        }
      } else {
        groups.set(key, {
          ...material,
          grouped_count: 1,
          grouped_ids: [material.id],
          locations: new Set(material.cabinet_name ? [material.cabinet_name] : []),
        });
      }
    });

    // Stock-Status für gruppierte Materialien neu berechnen
    return Array.from(groups.values()).map(g => {
      let stock_status = 'OK';
      
      // Prüfe auf niedrigen Bestand: Gesamtbestand < Mindestmenge
      if (g.min_stock > 0 && g.current_stock < g.min_stock) {
        stock_status = 'LOW';
      }
      // Prüfe auf ablaufend (innerhalb 30 Tagen)
      else if (g.expiry_date) {
        const daysUntilExpiry = Math.ceil((new Date(g.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        if (daysUntilExpiry <= 30) {
          stock_status = 'EXPIRING';
        }
      }
      
      return {
        ...g,
        stock_status,
        locations: Array.from(g.locations).join(', '),
      };
    });
  }, [filteredMaterials, groupIdentical]);

  const getFilterTitle = () => {
    if (activeFilter === 'lowStock') return 'Niedriger Bestand';
    if (activeFilter === 'expiring') return 'Ablaufende Materialien';
    return null;
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={1}>
        <Typography variant="h4" sx={{ fontSize: { xs: '1.5rem', sm: '2.125rem' } }}>Materialien</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon sx={{ display: { xs: 'none', sm: 'inline-block' } }} />}
          onClick={() => navigate('/materials/new')}
          size="small"
          sx={{ minWidth: { xs: 'auto', sm: 'unset' } }}
        >
          <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>Neues Material</Box>
          <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>Neu</Box>
        </Button>
      </Box>

      {activeFilter && (
        <Alert 
          severity={activeFilter === 'lowStock' ? 'warning' : 'error'}
          sx={{ mb: 2 }}
          onClose={async () => {
            setActiveFilter(null);
            navigate('/materials', { replace: true, state: {} });
            try {
              const response = await materialAPI.getAll();
              const data = Array.isArray(response.data) ? response.data : [];
              setMaterials(data);
            } catch (error) {
              console.error('Fehler beim Laden der Materialien:', error);
            }
          }}
        >
          Filter aktiv: <strong>{getFilterTitle()}</strong> ({filteredMaterials.length} {filteredMaterials.length === 1 ? 'Material' : 'Materialien'})
        </Alert>
      )}

      <Paper sx={{ p: 2, mb: 2 }}>
        {/* Suchfeld und Filter-Toggle */}
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <TextField
            sx={{ flex: 1, minWidth: 200 }}
            label="Suche"
            variant="outlined"
            size="small"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Name, GTIN, Kategorie, Firma, LOT..."
          />
          <Button
            variant={showFilters ? "contained" : "outlined"}
            startIcon={
              <Badge badgeContent={activeFilterCount} color="error">
                <FilterListIcon />
              </Badge>
            }
            onClick={() => setShowFilters(!showFilters)}
            size="small"
          >
            Filter
          </Button>
          {activeFilterCount > 0 && (
            <Button
              variant="outlined"
              color="error"
              startIcon={<ClearIcon />}
              onClick={clearFilters}
              size="small"
            >
              Filter löschen
            </Button>
          )}
        </Box>

        {/* Erweiterte Filter */}
        <Collapse in={showFilters}>
          <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
            <Grid container spacing={2}>
              <Grid item xs={6} sm={4} md={2}>
                <TextField
                  select
                  fullWidth
                  size="small"
                  label="Kategorie"
                  value={filters.category_id}
                  onChange={handleFilterChange('category_id')}
                >
                  <MenuItem value="">Alle</MenuItem>
                  {categories.map((cat) => (
                    <MenuItem key={cat.id} value={String(cat.id)}>{cat.name}</MenuItem>
                  ))}
                </TextField>
              </Grid>
              
              <Grid item xs={6} sm={4} md={2}>
                <TextField
                  select
                  fullWidth
                  size="small"
                  label="Firma"
                  value={filters.company_id}
                  onChange={handleFilterChange('company_id')}
                >
                  <MenuItem value="">Alle</MenuItem>
                  {companies.map((comp) => (
                    <MenuItem key={comp.id} value={String(comp.id)}>{comp.name}</MenuItem>
                  ))}
                </TextField>
              </Grid>
              
              <Grid item xs={6} sm={4} md={2}>
                <TextField
                  select
                  fullWidth
                  size="small"
                  label="Schrank"
                  value={filters.cabinet_id}
                  onChange={handleFilterChange('cabinet_id')}
                >
                  <MenuItem value="">Alle</MenuItem>
                  {cabinets.map((cab) => (
                    <MenuItem key={cab.id} value={String(cab.id)}>{cab.name}</MenuItem>
                  ))}
                </TextField>
              </Grid>
              
              <Grid item xs={6} sm={4} md={2}>
                <TextField
                  select
                  fullWidth
                  size="small"
                  label="Shape/Form"
                  value={filters.shape_id}
                  onChange={handleFilterChange('shape_id')}
                >
                  <MenuItem value="">Alle</MenuItem>
                  {shapes.map((shape) => (
                    <MenuItem key={shape.id} value={String(shape.id)}>{shape.name}</MenuItem>
                  ))}
                </TextField>
              </Grid>
              
              <Grid item xs={6} sm={4} md={2}>
                <TextField
                  fullWidth
                  size="small"
                  label="French-Size"
                  value={filters.french_size}
                  onChange={handleFilterChange('french_size')}
                  placeholder="z.B. 5F"
                />
              </Grid>
              
              <Grid item xs={6} sm={4} md={2}>
                <TextField
                  select
                  fullWidth
                  size="small"
                  label="Guidewire"
                  value={filters.guidewire_acceptance}
                  onChange={handleFilterChange('guidewire_acceptance')}
                >
                  <MenuItem value="">Alle</MenuItem>
                  {GUIDEWIRE_OPTIONS.map((opt) => (
                    <MenuItem key={opt} value={opt}>{opt}</MenuItem>
                  ))}
                </TextField>
              </Grid>
              
              <Grid item xs={6} sm={4} md={2}>
                <TextField
                  select
                  fullWidth
                  size="small"
                  label="Konsignation"
                  value={filters.is_consignment}
                  onChange={handleFilterChange('is_consignment')}
                >
                  <MenuItem value="">Alle</MenuItem>
                  <MenuItem value="true">Nur Konsignation</MenuItem>
                  <MenuItem value="false">Keine Konsignation</MenuItem>
                </TextField>
              </Grid>
              
              <Grid item xs={6} sm={4} md={2}>
                <TextField
                  fullWidth
                  size="small"
                  label="Device Length"
                  value={filters.device_length}
                  onChange={handleFilterChange('device_length')}
                  placeholder="z.B. >100, 80-120"
                  helperText=">, >=, <, <=, oder 8-10"
                />
              </Grid>
              
              <Grid item xs={6} sm={4} md={2}>
                <TextField
                  fullWidth
                  size="small"
                  label="Schaftlänge"
                  value={filters.shaft_length}
                  onChange={handleFilterChange('shaft_length')}
                  placeholder="z.B. >=80, 60-100"
                  helperText=">, >=, <, <=, oder 8-10"
                />
              </Grid>
              
              <Grid item xs={6} sm={4} md={2}>
                <TextField
                  fullWidth
                  size="small"
                  label="Device-Ø"
                  value={filters.device_diameter}
                  onChange={handleFilterChange('device_diameter')}
                  placeholder="z.B. <8, 5-7"
                  helperText=">, >=, <, <=, oder 8-10"
                />
              </Grid>
            </Grid>
          </Box>
        </Collapse>

        {/* Checkboxen */}
        <Box sx={{ mt: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <FormControlLabel
            control={
              <Checkbox
                checked={hideZeroStock}
                onChange={(e) => setHideZeroStock(e.target.checked)}
                color="primary"
              />
            }
            label="Materialien mit Bestand 0 ausblenden"
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={groupIdentical}
                onChange={(e) => setGroupIdentical(e.target.checked)}
                color="primary"
              />
            }
            label="Identische Materialien gruppieren (GTIN/Name)"
          />
        </Box>
      </Paper>

      <Paper sx={{ height: { xs: 400, sm: 600 }, width: '100%' }}>
        <DataGrid
          rows={groupedMaterials}
          columns={columns}
          loading={loading}
          pageSizeOptions={[10, 25, 50, 100]}
          initialState={{
            pagination: { paginationModel: { pageSize: 25 } },
          }}
          columnVisibilityModel={columnSettings.visibility}
          onColumnVisibilityModelChange={(newModel) => {
            setColumnSettings(prev => ({ ...prev, visibility: newModel }));
          }}
          disableRowSelectionOnClick
          sx={{
            '& .MuiDataGrid-cell': {
              fontSize: { xs: '0.75rem', sm: '0.875rem' },
              padding: { xs: '4px', sm: '8px' },
            },
            '& .MuiDataGrid-columnHeaders': {
              fontSize: { xs: '0.75rem', sm: '0.875rem' },
            },
          }}
        />
      </Paper>
    </Box>
  );
};

export default Materials;
