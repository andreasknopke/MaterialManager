import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Card,
  CardContent,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Chip,
  Alert,
  Divider,
  Tooltip,
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  RemoveCircleOutline as RemoveIcon,
  Receipt as ReceiptIcon,
  Print as PrintIcon,
  Close as CloseIcon,
  Delete as DeleteIcon,
  LocalHospital as HospitalIcon,
} from '@mui/icons-material';

// Interventionsmodus State (wird in localStorage persistiert)
export interface InterventionItem {
  id: string;
  timestamp: Date;
  materialName: string;
  articleNumber: string;
  lotNumber: string;
  quantity: number;
  gtin?: string;
}

export interface InterventionSession {
  active: boolean;
  startTime: Date | null;
  patientId?: string;
  items: InterventionItem[];
}

// Globale Funktionen für Interventionsmodus
export const getInterventionSession = (): InterventionSession => {
  const stored = localStorage.getItem('interventionSession');
  if (stored) {
    const session = JSON.parse(stored);
    return {
      ...session,
      startTime: session.startTime ? new Date(session.startTime) : null,
      items: session.items.map((item: any) => ({
        ...item,
        timestamp: new Date(item.timestamp)
      }))
    };
  }
  return { active: false, startTime: null, items: [] };
};

export const saveInterventionSession = (session: InterventionSession) => {
  localStorage.setItem('interventionSession', JSON.stringify(session));
};

export const addInterventionItem = (item: Omit<InterventionItem, 'id' | 'timestamp'>) => {
  const session = getInterventionSession();
  if (session.active) {
    const newItem: InterventionItem = {
      ...item,
      id: Date.now().toString(),
      timestamp: new Date(),
    };
    session.items.push(newItem);
    saveInterventionSession(session);
    return true;
  }
  return false;
};

export const clearInterventionSession = () => {
  localStorage.removeItem('interventionSession');
};

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [interventionSession, setInterventionSession] = useState<InterventionSession>(getInterventionSession());
  const [showInterventionDialog, setShowInterventionDialog] = useState(false);
  const [showProtocolDialog, setShowProtocolDialog] = useState(false);
  const [showEndConfirmDialog, setShowEndConfirmDialog] = useState(false);

  // Aktualisiere Session-State wenn sich localStorage ändert
  useEffect(() => {
    const handleStorageChange = () => {
      setInterventionSession(getInterventionSession());
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    // Auch bei Fokus aktualisieren (für gleichen Tab)
    const handleFocus = () => {
      setInterventionSession(getInterventionSession());
    };
    window.addEventListener('focus', handleFocus);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  // Erfassen: Direkt zum neuen Material Formular
  const handleCapture = () => {
    navigate('/materials/new');
  };

  // Suche: Zur Suchseite
  const handleSearch = () => {
    navigate('/search');
  };

  // Entnahme: Prüfen ob Interventionsmodus gefragt werden soll
  const handleRemoval = () => {
    if (!interventionSession.active) {
      setShowInterventionDialog(true);
    } else {
      // Bereits im Interventionsmodus - direkt zum Scanner
      navigate('/scanner', { state: { removalMode: true } });
    }
  };

  // Interventionsmodus starten
  const startInterventionMode = () => {
    const newSession: InterventionSession = {
      active: true,
      startTime: new Date(),
      items: [],
    };
    saveInterventionSession(newSession);
    setInterventionSession(newSession);
    setShowInterventionDialog(false);
    navigate('/scanner', { state: { removalMode: true } });
  };

  // Ohne Interventionsmodus fortfahren
  const skipInterventionMode = () => {
    setShowInterventionDialog(false);
    navigate('/scanner', { state: { removalMode: true } });
  };

  // Protokoll anzeigen
  const handleProtocol = () => {
    // Aktualisiere zuerst den Session-State
    setInterventionSession(getInterventionSession());
    setShowProtocolDialog(true);
  };

  // Interventionsmodus beenden
  const endInterventionMode = () => {
    setShowEndConfirmDialog(true);
  };

  const confirmEndIntervention = () => {
    clearInterventionSession();
    setInterventionSession({ active: false, startTime: null, items: [] });
    setShowEndConfirmDialog(false);
    setShowProtocolDialog(false);
  };

  // Protokoll drucken
  const handlePrint = () => {
    const printContent = document.getElementById('protocol-print-content');
    if (printContent) {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head>
              <title>Interventions-Protokoll</title>
              <style>
                body { font-family: Arial, sans-serif; padding: 20px; }
                h1 { font-size: 18px; margin-bottom: 10px; }
                h2 { font-size: 14px; color: #666; margin-bottom: 20px; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
                th { background-color: #f5f5f5; }
                .header { margin-bottom: 20px; }
                .footer { margin-top: 30px; font-size: 11px; color: #666; }
                .no-print { display: none !important; }
              </style>
            </head>
            <body>
              ${printContent.innerHTML}
              <div class="footer">
                Gedruckt am: ${new Date().toLocaleString('de-DE')}
              </div>
            </body>
          </html>
        `);
        printWindow.document.close();
        printWindow.print();
      }
    }
  };

  // Item aus Protokoll löschen
  const removeProtocolItem = (itemId: string) => {
    const session = getInterventionSession();
    session.items = session.items.filter(item => item.id !== itemId);
    saveInterventionSession(session);
    setInterventionSession(session);
  };

  // Formatiere Zeit
  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('de-DE');
  };

  // Die vier Hauptbuttons
  const mainButtons = [
    {
      id: 'capture',
      title: 'Erfassen',
      subtitle: 'Neues Material anlegen',
      icon: <AddIcon sx={{ fontSize: 80 }} />,
      color: '#4caf50',
      onClick: handleCapture,
      disabled: false,
    },
    {
      id: 'search',
      title: 'Suche',
      subtitle: 'LOT, Verfall, Kategorie',
      icon: <SearchIcon sx={{ fontSize: 80 }} />,
      color: '#2196f3',
      onClick: handleSearch,
      disabled: false,
    },
    {
      id: 'removal',
      title: 'Entnahme',
      subtitle: interventionSession.active ? 'Interventionsmodus aktiv' : 'Material ausbuchen',
      icon: <RemoveIcon sx={{ fontSize: 80 }} />,
      color: interventionSession.active ? '#ff9800' : '#9c27b0',
      onClick: handleRemoval,
      disabled: false,
      badge: interventionSession.active ? interventionSession.items.length : undefined,
    },
    {
      id: 'protocol',
      title: 'Protokoll',
      subtitle: interventionSession.active ? `${interventionSession.items.length} Entnahmen` : 'Kein aktives Protokoll',
      icon: <ReceiptIcon sx={{ fontSize: 80 }} />,
      color: interventionSession.active ? '#ff5722' : '#9e9e9e',
      onClick: handleProtocol,
      disabled: !interventionSession.active,
      badge: interventionSession.active ? interventionSession.items.length : undefined,
    },
  ];

  return (
    <Box sx={{ p: { xs: 1, sm: 2 } }}>
      {/* Interventionsmodus Banner */}
      {interventionSession.active && (
        <Alert 
          severity="warning" 
          sx={{ mb: 3 }}
          icon={<HospitalIcon />}
          action={
            <Button color="inherit" size="small" onClick={handleProtocol}>
              Protokoll anzeigen
            </Button>
          }
        >
          <strong>Interventionsmodus aktiv</strong> seit {interventionSession.startTime && formatTime(interventionSession.startTime)} 
          {' '}- {interventionSession.items.length} Entnahme(n) protokolliert
        </Alert>
      )}

      {/* Hauptbuttons */}
      <Grid container spacing={3} justifyContent="center">
        {mainButtons.map((button) => (
          <Grid item xs={6} sm={6} md={3} key={button.id}>
            <Card
              sx={{
                height: '100%',
                minHeight: { xs: 180, sm: 220 },
                cursor: button.disabled ? 'not-allowed' : 'pointer',
                transition: 'all 0.3s ease',
                opacity: button.disabled ? 0.5 : 1,
                position: 'relative',
                '&:hover': button.disabled ? {} : {
                  transform: 'translateY(-8px)',
                  boxShadow: 6,
                  '& .icon-box': {
                    transform: 'scale(1.1)',
                  }
                },
              }}
              onClick={button.disabled ? undefined : button.onClick}
            >
              {/* Badge */}
              {button.badge !== undefined && button.badge > 0 && (
                <Chip
                  label={button.badge}
                  color="error"
                  size="small"
                  sx={{
                    position: 'absolute',
                    top: 10,
                    right: 10,
                    fontWeight: 'bold',
                  }}
                />
              )}
              
              <CardContent
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  textAlign: 'center',
                  p: { xs: 2, sm: 3 },
                }}
              >
                <Box
                  className="icon-box"
                  sx={{
                    color: button.color,
                    mb: 2,
                    transition: 'transform 0.3s ease',
                  }}
                >
                  {button.icon}
                </Box>
                <Typography variant="h5" component="div" fontWeight="bold" gutterBottom>
                  {button.title}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {button.subtitle}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Interventionsmodus Dialog */}
      <Dialog
        open={showInterventionDialog}
        onClose={() => setShowInterventionDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <HospitalIcon color="primary" />
            Interventionsmodus aktivieren?
          </Box>
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Möchten Sie den <strong>Interventionsmodus mit Patienten-Protokoll</strong> aktivieren?
          </DialogContentText>
          <Paper sx={{ p: 2, bgcolor: 'info.light', color: 'info.contrastText' }}>
            <Typography variant="body2">
              <strong>Im Interventionsmodus:</strong>
              <ul style={{ margin: '8px 0 0 0', paddingLeft: 20 }}>
                <li>Jede Entnahme wird automatisch protokolliert</li>
                <li>Sie können das Protokoll jederzeit einsehen</li>
                <li>Am Ende können Sie die Liste ausdrucken</li>
                <li>Ideal für die Dokumentation in der Patientenakte</li>
              </ul>
            </Typography>
          </Paper>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={skipInterventionMode} variant="outlined">
            Ohne Protokoll fortfahren
          </Button>
          <Button onClick={startInterventionMode} variant="contained" color="primary" startIcon={<HospitalIcon />}>
            Mit Protokoll starten
          </Button>
        </DialogActions>
      </Dialog>

      {/* Protokoll Dialog */}
      <Dialog
        open={showProtocolDialog}
        onClose={() => setShowProtocolDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Box display="flex" alignItems="center" gap={1}>
              <ReceiptIcon color="primary" />
              Interventions-Protokoll
            </Box>
            <IconButton onClick={() => setShowProtocolDialog(false)}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          {/* Druckbarer Inhalt */}
          <div id="protocol-print-content">
            <div className="header">
              <Typography variant="h6">Interventions-Protokoll</Typography>
              {interventionSession.startTime && (
                <Typography variant="body2" color="text.secondary">
                  Begonnen: {formatDate(interventionSession.startTime)} um {formatTime(interventionSession.startTime)}
                </Typography>
              )}
            </div>

            {interventionSession.items.length === 0 ? (
              <Alert severity="info" sx={{ mt: 2 }}>
                Noch keine Entnahmen protokolliert.
              </Alert>
            ) : (
              <TableContainer component={Paper} variant="outlined" sx={{ mt: 2 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Zeit</TableCell>
                      <TableCell>Material</TableCell>
                      <TableCell>Artikel-Nr.</TableCell>
                      <TableCell>LOT</TableCell>
                      <TableCell align="right">Menge</TableCell>
                      <TableCell align="center" className="no-print">Aktion</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {interventionSession.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{formatTime(item.timestamp)}</TableCell>
                        <TableCell>{item.materialName}</TableCell>
                        <TableCell>{item.articleNumber || '-'}</TableCell>
                        <TableCell>{item.lotNumber || '-'}</TableCell>
                        <TableCell align="right">{item.quantity}</TableCell>
                        <TableCell align="center" className="no-print">
                          <Tooltip title="Entfernen">
                            <IconButton 
                              size="small" 
                              color="error"
                              onClick={() => removeProtocolItem(item.id)}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </div>

          <Divider sx={{ my: 3 }} />

          <Typography variant="body2" color="text.secondary">
            Gesamtanzahl Entnahmen: <strong>{interventionSession.items.length}</strong>
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, justifyContent: 'space-between' }}>
          <Button 
            onClick={endInterventionMode} 
            color="error" 
            variant="outlined"
            startIcon={<CloseIcon />}
          >
            Intervention beenden
          </Button>
          <Box>
            <Button 
              onClick={handlePrint} 
              variant="contained" 
              startIcon={<PrintIcon />}
              disabled={interventionSession.items.length === 0}
              sx={{ mr: 1 }}
            >
              Drucken
            </Button>
            <Button onClick={() => setShowProtocolDialog(false)} variant="outlined">
              Schließen
            </Button>
          </Box>
        </DialogActions>
      </Dialog>

      {/* Bestätigung Intervention beenden */}
      <Dialog
        open={showEndConfirmDialog}
        onClose={() => setShowEndConfirmDialog(false)}
      >
        <DialogTitle>Intervention beenden?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Möchten Sie den Interventionsmodus wirklich beenden?
            {interventionSession.items.length > 0 && (
              <strong> Das Protokoll mit {interventionSession.items.length} Entnahme(n) wird gelöscht.</strong>
            )}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowEndConfirmDialog(false)}>Abbrechen</Button>
          <Button onClick={confirmEndIntervention} color="error" variant="contained">
            Intervention beenden
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Dashboard;
