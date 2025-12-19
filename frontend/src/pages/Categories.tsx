import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Typography,
  Paper,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Chip,
  MenuItem,
  Tooltip,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { 
  Add as AddIcon, 
  Edit as EditIcon, 
  Delete as DeleteIcon,
  QrCode2 as QrCodeIcon,
  Print as PrintIcon,
  OpenInNew as OpenInNewIcon,
} from '@mui/icons-material';
import { QRCodeSVG } from 'qrcode.react';
import { categoryAPI, cabinetAPI } from '../services/api';

const Categories: React.FC = () => {
  const [categories, setCategories] = useState<any[]>([]);
  const [cabinets, setCabinets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any>(null);
  const [formData, setFormData] = useState({ name: '', description: '', min_quantity: 0, ops_code: '', zusatzentgelt: '', endo_today_link: '' });

  // QR-Code Dialog State
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [qrCategory, setQrCategory] = useState<any>(null);
  const [qrCabinetId, setQrCabinetId] = useState<number | ''>('');

  useEffect(() => {
    fetchCategories();
    fetchCabinets();
  }, []);

  const fetchCategories = async () => {
    try {
      const response = await categoryAPI.getAll();
      const data = Array.isArray(response.data) ? response.data : [];
      setCategories(data);
    } catch (error) {
      console.error('Fehler beim Laden der Kategorien:', error);
      setCategories([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchCabinets = async () => {
    try {
      const response = await cabinetAPI.getAll();
      const data = Array.isArray(response.data) ? response.data : [];
      setCabinets(data);
    } catch (error) {
      console.error('Fehler beim Laden der Schränke:', error);
      setCabinets([]);
    }
  };

  const handleOpen = (category?: any) => {
    if (category) {
      setEditingCategory(category);
      setFormData({ 
        name: category.name, 
        description: category.description || '',
        min_quantity: category.min_quantity || 0,
        ops_code: category.ops_code || '',
        zusatzentgelt: category.zusatzentgelt || '',
        endo_today_link: category.endo_today_link || ''
      });
    } else {
      setEditingCategory(null);
      setFormData({ name: '', description: '', min_quantity: 0, ops_code: '', zusatzentgelt: '', endo_today_link: '' });
    }
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setEditingCategory(null);
  };

  const handleSave = async () => {
    try {
      if (editingCategory) {
        await categoryAPI.update(editingCategory.id, formData);
      } else {
        await categoryAPI.create(formData);
      }
      fetchCategories();
      handleClose();
    } catch (error) {
      console.error('Fehler beim Speichern:', error);
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Kategorie wirklich löschen?')) {
      try {
        await categoryAPI.delete(id);
        fetchCategories();
      } catch (error) {
        console.error('Fehler beim Löschen:', error);
      }
    }
  };

  // QR-Code Funktionen
  const handleOpenQrDialog = (category: any) => {
    setQrCategory(category);
    setQrCabinetId('');
    setQrDialogOpen(true);
  };

  const handleCloseQrDialog = () => {
    setQrDialogOpen(false);
    setQrCategory(null);
    setQrCabinetId('');
  };

  const getQrData = () => {
    if (!qrCategory) return '';
    
    const selectedCabinet = qrCabinetId ? cabinets.find(c => c.id === qrCabinetId) : null;
    
    const qrPayload = {
      type: 'CATEGORY',
      id: qrCategory.id,
      name: qrCategory.name,
      ops_code: qrCategory.ops_code || null,
      zusatzentgelt: qrCategory.zusatzentgelt || null,
      min_quantity: qrCategory.min_quantity || 0,
      cabinet: selectedCabinet ? {
        id: selectedCabinet.id,
        name: selectedCabinet.name,
        location: selectedCabinet.location || null,
      } : null,
    };
    
    return JSON.stringify(qrPayload);
  };

  const handlePrintQrCode = () => {
    const selectedCabinet = qrCabinetId ? cabinets.find(c => c.id === qrCabinetId) : null;
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const qrData = getQrData();
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>QR-Code Schild - ${qrCategory?.name}</title>
        <style>
          @page {
            size: 100mm 70mm;
            margin: 5mm;
          }
          body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 10px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            box-sizing: border-box;
          }
          .label-container {
            border: 2px solid #333;
            border-radius: 8px;
            padding: 15px;
            text-align: center;
            background: white;
            max-width: 90mm;
          }
          .category-name {
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 10px;
            color: #1976d2;
          }
          .cabinet-info {
            font-size: 12px;
            color: #666;
            margin-bottom: 10px;
          }
          .qr-code {
            margin: 10px 0;
          }
          .codes-info {
            font-size: 10px;
            color: #888;
            margin-top: 10px;
          }
          .codes-info span {
            display: block;
          }
          @media print {
            body {
              min-height: auto;
            }
          }
        </style>
      </head>
      <body>
        <div class="label-container">
          <div class="category-name">${qrCategory?.name || ''}</div>
          ${selectedCabinet ? `<div class="cabinet-info">📍 ${selectedCabinet.name}${selectedCabinet.location ? ' - ' + selectedCabinet.location : ''}</div>` : ''}
          <div class="qr-code" id="qr-container"></div>
          <div class="codes-info">
            ${qrCategory?.ops_code ? `<span>OPS: ${qrCategory.ops_code}</span>` : ''}
            ${qrCategory?.zusatzentgelt ? `<span>ZE: ${qrCategory.zusatzentgelt}</span>` : ''}
          </div>
        </div>
        <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js"></script>
        <script>
          QRCode.toCanvas(document.createElement('canvas'), ${JSON.stringify(qrData)}, { width: 150 }, function(error, canvas) {
            if (error) console.error(error);
            document.getElementById('qr-container').appendChild(canvas);
            setTimeout(function() { window.print(); }, 500);
          });
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  const columns: GridColDef[] = [
    { field: 'id', headerName: 'ID', width: 70 },
    { field: 'name', headerName: 'Name', width: 200 },
    { field: 'description', headerName: 'Beschreibung', flex: 1 },
    { field: 'ops_code', headerName: 'OPS-Code', width: 120 },
    { field: 'zusatzentgelt', headerName: 'Zusatzentgelt (ZE)', width: 140 },
    { 
      field: 'endo_today_link', 
      headerName: 'Endo Today', 
      width: 100,
      renderCell: (params) => (
        params.value ? (
          <Tooltip title="Endovascular Today öffnen">
            <IconButton 
              size="small" 
              onClick={() => window.open(params.value, '_blank')}
              color="primary"
            >
              <OpenInNewIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        ) : <Typography variant="body2" color="text.disabled">-</Typography>
      )
    },
    { 
      field: 'min_quantity', 
      headerName: 'Mindestmenge', 
      width: 130,
      renderCell: (params) => (
        <Chip 
          label={params.value || 0} 
          size="small" 
          color={params.value > 0 ? 'primary' : 'default'}
        />
      )
    },
    {
      field: 'actions',
      headerName: 'Aktionen',
      width: 160,
      sortable: false,
      renderCell: (params) => (
        <>
          <Tooltip title="QR-Code erstellen">
            <IconButton size="small" onClick={() => handleOpenQrDialog(params.row)}>
              <QrCodeIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Bearbeiten">
            <IconButton size="small" onClick={() => handleOpen(params.row)}>
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Löschen">
            <IconButton size="small" onClick={() => handleDelete(params.row.id)}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </>
      ),
    },
  ];

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Kategorien</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpen()}>
          Neue Kategorie
        </Button>
      </Box>

      <Paper sx={{ height: 600, width: '100%' }}>
        <DataGrid
          rows={categories}
          columns={columns}
          loading={loading}
          pageSizeOptions={[10, 25, 50]}
          initialState={{
            pagination: { paginationModel: { pageSize: 25 } },
          }}
          disableRowSelectionOnClick
        />
      </Paper>

      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>{editingCategory ? 'Kategorie bearbeiten' : 'Neue Kategorie'}</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            margin="normal"
            required
          />
          <TextField
            fullWidth
            label="Beschreibung"
            multiline
            rows={3}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            margin="normal"
          />
          <TextField
            fullWidth
            label="Mindestmenge (gesamt für alle Materialien dieser Kategorie)"
            type="number"
            value={formData.min_quantity}
            onChange={(e) => setFormData({ ...formData, min_quantity: parseInt(e.target.value) || 0 })}
            margin="normal"
            helperText="Die Gesamtmenge aller Materialien dieser Kategorie sollte mindestens diesen Wert haben"
            InputProps={{ inputProps: { min: 0 } }}
          />
          <TextField
            fullWidth
            label="OPS-Code"
            value={formData.ops_code}
            onChange={(e) => setFormData({ ...formData, ops_code: e.target.value })}
            margin="normal"
            helperText="Operationen- und Prozedurenschlüssel (optional)"
            placeholder="z.B. 8-83b.c1"
          />
          <TextField
            fullWidth
            label="Zusatzentgelt (ZE)"
            value={formData.zusatzentgelt}
            onChange={(e) => setFormData({ ...formData, zusatzentgelt: e.target.value })}
            margin="normal"
            helperText="Zusatzentgelt-Code für Krankenhausabrechnung (optional)"
            placeholder="z.B. ZE2025-123"
          />
          <TextField
            fullWidth
            label="Endovascular Today Link"
            value={formData.endo_today_link}
            onChange={(e) => setFormData({ ...formData, endo_today_link: e.target.value })}
            margin="normal"
            helperText="Link zur Endovascular Today Seite (optional)"
            placeholder="https://evtoday.com/..."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Abbrechen</Button>
          <Button onClick={handleSave} variant="contained">
            Speichern
          </Button>
        </DialogActions>
      </Dialog>

      {/* QR-Code Dialog */}
      <Dialog open={qrDialogOpen} onClose={handleCloseQrDialog} maxWidth="sm" fullWidth>
        <DialogTitle>QR-Code Schild erstellen</DialogTitle>
        <DialogContent>
          {qrCategory && (
            <Box sx={{ textAlign: 'center', py: 2 }}>
              <Typography variant="h6" gutterBottom color="primary">
                {qrCategory.name}
              </Typography>
              
              <TextField
                select
                fullWidth
                label="Schrank (optional)"
                value={qrCabinetId}
                onChange={(e) => setQrCabinetId(e.target.value as number | '')}
                margin="normal"
                helperText={cabinets.length === 0 ? 'Keine Schränke verfügbar' : 'Wählen Sie optional einen Schrank für das Schild'}
              >
                <MenuItem value="">Kein Schrank</MenuItem>
                {cabinets.length > 0 ? (
                  cabinets.map((cabinet) => (
                    <MenuItem key={cabinet.id} value={cabinet.id}>
                      {cabinet.name} {cabinet.location && `(${cabinet.location})`}
                    </MenuItem>
                  ))
                ) : (
                  <MenuItem disabled>Keine Schränke geladen</MenuItem>
                )}
              </TextField>

              <Box sx={{ my: 3, p: 2, border: '2px dashed #ccc', borderRadius: 2, bgcolor: '#fafafa' }}>
                <Typography variant="caption" color="text.secondary" display="block" mb={2}>
                  Vorschau:
                </Typography>
                <QRCodeSVG
                  value={getQrData()}
                  size={180}
                  level="M"
                  includeMargin
                />
                <Typography variant="h6" sx={{ mt: 2, fontWeight: 'bold' }}>
                  {qrCategory.name}
                </Typography>
                {qrCabinetId && (
                  <Typography variant="body2" color="text.secondary">
                    📍 {cabinets.find(c => c.id === qrCabinetId)?.name}
                  </Typography>
                )}
                {(qrCategory.ops_code || qrCategory.zusatzentgelt) && (
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                    {qrCategory.ops_code && `OPS: ${qrCategory.ops_code}`}
                    {qrCategory.ops_code && qrCategory.zusatzentgelt && ' | '}
                    {qrCategory.zusatzentgelt && `ZE: ${qrCategory.zusatzentgelt}`}
                  </Typography>
                )}
              </Box>

              <Typography variant="caption" color="text.secondary" display="block">
                Der QR-Code enthält: Kategorie-ID, Name, OPS-Code, Zusatzentgelt
                {qrCabinetId ? ' und Schrank-Informationen' : ''}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseQrDialog}>Abbrechen</Button>
          <Button 
            onClick={handlePrintQrCode} 
            variant="contained" 
            startIcon={<PrintIcon />}
            color="primary"
          >
            Drucken
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Categories;
