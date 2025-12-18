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
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemButton,
  Tabs,
  Tab,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, Business as BusinessIcon } from '@mui/icons-material';
import { companyAPI, unitAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

// EU-registrierte Medizintechnik-Firmen
const EU_REGISTERED_COMPANIES = [
  "Aachen Resonance GmbH",
  "Abbott",
  "Acandis GmbH",
  "Advanced Vascular Dynamics",
  "ALN",
  "Alvimedica",
  "amg International GmbH",
  "Andramed GmbH",
  "AndraTec GmbH",
  "AngioDynamics",
  "Argon Medical Devices",
  "Arthesys",
  "Artivion",
  "ArtVentive Medical Group",
  "Asahi Intecc Co Ltd.",
  "Avinger",
  "B. Braun Melsungen",
  "Balt",
  "Balton",
  "Bard Access Systems",
  "BD Interventional",
  "Bentley InnoMed",
  "BioCardia",
  "Biolas",
  "Biosensors International",
  "Blockade Medical",
  "Boston Scientific Corporation",
  "BrosMed Medical",
  "Cagent Vascular",
  "Cardionovum",
  "Cerenovus",
  "Concept Medical",
  "Contego Medical LLC",
  "Control Medical Technology",
  "Cook Medical",
  "Cordis",
  "Dornier MedTech",
  "Edwards Lifesciences",
  "EndoCross",
  "Endologix",
  "eucatech",
  "Eurocor",
  "F Care Systems",
  "Forge Medical",
  "Front Line Medical Technologies",
  "Galt",
  "Getinge (Advanta)",
  "Gore",
  "Haemonetics",
  "iMS",
  "Inari Medical",
  "Infraredx",
  "InspireMD",
  "Invamed",
  "iVascular",
  "Joline",
  "Kawasumi Laboratories",
  "LeMaitre Vascular",
  "Lombard Medical",
  "MedAlliance",
  "Medcomp",
  "Medtronic (EV3)",
  "Meril Life Sciences",
  "Merit Medical Systems",
  "Mermaid Medical",
  "Micro Medical Solutions",
  "Natec Medical",
  "Opsens Medical",
  "optimed Medizinische Instrumente",
  "Oscor",
  "Pediavascular",
  "Penumbra",
  "Perflow Medical",
  "phenox",
  "Philips",
  "Prytime Medical Devices",
  "Q3 Medical Group",
  "Ra Medical Systems",
  "Rapid Medical",
  "Recor Medical",
  "Reflow Medical",
  "RenalGuard Solutions",
  "Rontis",
  "Scitech Medical",
  "Shape Memory Medical",
  "Shockwave Medical",
  "Simeks Medical",
  "STARmed",
  "Stryker",
  "Teleflex (Biotronik)",
  "Terumo",
  "ThermopeutiX",
  "Tokai Medical Products",
  "Total Vein Systems",
  "Translational Research Institute",
  "Tricol Biomedical",
  "TriReme Medical LLC",
  "TriSalus Life Sciences",
  "Varian Medical Systems",
  "VentureMed Group",
  "Veryan Medical",
  "Vesalio",
  "Wallaby Medical",
  "Z-Medica"
].sort();

const Companies: React.FC = () => {
  const { user } = useAuth();
  const [companies, setCompanies] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [euCompaniesDialogOpen, setEuCompaniesDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingCompany, setEditingCompany] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: '',
    contact_person: '',
    email: '',
    phone: '',
    address: '',
    department_id: null as number | null,
  });

  useEffect(() => {
    fetchCompanies();
    if (user?.isRoot) {
      fetchDepartments();
    }
  }, [user?.isRoot]);

  const fetchCompanies = async () => {
    try {
      const response = await companyAPI.getAll();
      const data = Array.isArray(response.data) ? response.data : [];
      setCompanies(data);
    } catch (error) {
      console.error('Fehler beim Laden der Firmen:', error);
      setCompanies([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const response = await unitAPI.getAll();
      const data = Array.isArray(response.data) ? response.data : [];
      setDepartments(data);
    } catch (error) {
      console.error('Fehler beim Laden der Departments:', error);
    }
  };

  const handleOpen = (company?: any) => {
    if (company) {
      setEditingCompany(company);
      setFormData({
        name: company.name || '',
        contact_person: company.contact_person || '',
        email: company.email || '',
        phone: company.phone || '',
        address: company.address || '',
        department_id: company.department_id || null,
      });
    } else {
      setEditingCompany(null);
      setFormData({ 
        name: '', 
        contact_person: '', 
        email: '', 
        phone: '', 
        address: '',
        department_id: user?.departmentId || null
      });
    }
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setEditingCompany(null);
  };

  const handleSave = async () => {
    try {
      if (editingCompany) {
        await companyAPI.update(editingCompany.id, formData);
      } else {
        await companyAPI.create(formData);
      }
      fetchCompanies();
      handleClose();
    } catch (error) {
      console.error('Fehler beim Speichern:', error);
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Firma wirklich löschen?')) {
      try {
        await companyAPI.delete(id);
        fetchCompanies();
      } catch (error) {
        console.error('Fehler beim Löschen:', error);
      }
    }
  };

  const handleAddEuCompany = async (companyName: string) => {
    try {
      await companyAPI.create({
        name: companyName,
        contact_person: '',
        email: '',
        phone: '',
        address: '',
        department_id: user?.departmentId || null
      });
      fetchCompanies();
      setEuCompaniesDialogOpen(false);
    } catch (error) {
      console.error('Fehler beim Hinzufügen der Firma:', error);
    }
  };

  const filteredEuCompanies = EU_REGISTERED_COMPANIES.filter(company =>
    company.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Prüfe welche EU-Firmen bereits in der Datenbank existieren
  const existingCompanyNames = new Set(companies.map(c => c.name.toLowerCase()));
  const availableEuCompanies = filteredEuCompanies.filter(
    company => !existingCompanyNames.has(company.toLowerCase())
  );

  const columns: GridColDef[] = [
    { field: 'id', headerName: 'ID', width: 70 },
    { field: 'name', headerName: 'Name', width: 180 },
    { 
      field: 'department_name', 
      headerName: 'Department', 
      width: 150,
      renderCell: (params) => params.value ? <Chip label={params.value} size="small" color="primary" /> : '-'
    },
    { field: 'contact_person', headerName: 'Ansprechpartner', width: 150 },
    { field: 'email', headerName: 'E-Mail', width: 180 },
    { field: 'phone', headerName: 'Telefon', width: 130 },
    {
      field: 'actions',
      headerName: 'Aktionen',
      width: 120,
      sortable: false,
      renderCell: (params) => (
        <>
          <IconButton size="small" onClick={() => handleOpen(params.row)}>
            <EditIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" onClick={() => handleDelete(params.row.id)}>
            <DeleteIcon fontSize="small" />
          </IconButton>
        </>
      ),
    },
  ];

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Firmen</Typography>
        <Box display="flex" gap={2}>
          <Button 
            variant="outlined" 
            startIcon={<BusinessIcon />} 
            onClick={() => setEuCompaniesDialogOpen(true)}
          >
            EU-Firmen hinzufügen
          </Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpen()}>
            Neue Firma
          </Button>
        </Box>
      </Box>

      <Paper sx={{ height: 600, width: '100%' }}>
        <DataGrid
          rows={companies}
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
        <DialogTitle>{editingCompany ? 'Firma bearbeiten' : 'Neue Firma'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Ansprechpartner"
                value={formData.contact_person}
                onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="E-Mail"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Telefon"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Adresse"
                multiline
                rows={3}
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </Grid>
            {user?.isRoot && (
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Department</InputLabel>
                  <Select
                    value={formData.department_id || ''}
                    onChange={(e) => setFormData({ ...formData, department_id: e.target.value as number })}
                    label="Department"
                  >
                    <MenuItem value="">
                      <em>Kein Department</em>
                    </MenuItem>
                    {departments.map((dept) => (
                      <MenuItem key={dept.id} value={dept.id}>
                        {dept.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Abbrechen</Button>
          <Button onClick={handleSave} variant="contained">
            Speichern
          </Button>
        </DialogActions>
      </Dialog>

      {/* EU-Firmen Dialog */}
      <Dialog 
        open={euCompaniesDialogOpen} 
        onClose={() => setEuCompaniesDialogOpen(false)} 
        maxWidth="md" 
        fullWidth
      >
        <DialogTitle>
          EU-registrierte Medizintechnik-Firmen
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Wählen Sie Firmen aus, um sie zur lokalen Liste hinzuzufügen
          </Typography>
        </DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Suche"
            variant="outlined"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            sx={{ mb: 2, mt: 1 }}
            placeholder="Firmenname suchen..."
          />
          <Paper variant="outlined" sx={{ maxHeight: 400, overflow: 'auto' }}>
            <List>
              {availableEuCompanies.length > 0 ? (
                availableEuCompanies.map((company, index) => (
                  <ListItem key={index} disablePadding>
                    <ListItemButton onClick={() => handleAddEuCompany(company)}>
                      <ListItemText 
                        primary={company}
                        secondary="Klicken zum Hinzufügen"
                      />
                    </ListItemButton>
                  </ListItem>
                ))
              ) : (
                <ListItem>
                  <ListItemText 
                    primary={searchTerm ? "Keine Firmen gefunden" : "Alle EU-Firmen bereits hinzugefügt"}
                    sx={{ textAlign: 'center', color: 'text.secondary' }}
                  />
                </ListItem>
              )}
            </List>
          </Paper>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
            {availableEuCompanies.length} von {EU_REGISTERED_COMPANIES.length} Firmen verfügbar
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setEuCompaniesDialogOpen(false);
            setSearchTerm('');
          }}>
            Schließen
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Companies;
