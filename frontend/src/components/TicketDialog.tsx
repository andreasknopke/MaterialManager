import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogContent,
  TextField,
  Alert,
  IconButton,
  Stack,
  Typography,
  CircularProgress,
  Divider,
} from '@mui/material';
import {
  BugReportRounded as BugIcon,
  LightbulbOutlined as FeatureIcon,
  CloseRounded as CloseIcon,
  CheckCircleRounded as SuccessIcon,
  ErrorOutlineRounded as ErrorIcon,
  SendRounded as SendIcon,
  ReplayRounded as RetryIcon,
  InfoOutlined as InfoIcon,
} from '@mui/icons-material';
import { createTicket, TicketType } from '../services/ticketService';
import { useAuth } from '../contexts/AuthContext';

interface TicketDialogProps {
  open: boolean;
  onClose: () => void;
}

type TicketStatus = 'form' | 'success' | 'error';

export default function TicketDialog({ open, onClose }: TicketDialogProps) {
  const { user } = useAuth();
  const [type, setType] = useState<TicketType>('bug');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<TicketStatus>('form');
  const [resultMessage, setResultMessage] = useState('');

  useEffect(() => {
    if (open && user?.email && !contactEmail) {
      setContactEmail(user.email);
    }
  }, [open, user?.email, contactEmail]);

  const descriptionPlaceholder = useMemo(() => {
    if (type === 'bug') {
      return 'Schritte zum Reproduzieren:\n1. ...\n2. ...\n\nErwartetes Verhalten:\n...\n\nTatsächliches Verhalten:\n...';
    }

    return 'Beschreiben Sie Ihren Vorschlag möglichst detailliert und welchen Nutzen er im Alltag hätte...';
  }, [type]);

  const resetForm = () => {
    setType('bug');
    setTitle('');
    setDescription('');
    setLoading(false);
    setStatus('form');
    setResultMessage('');
    setContactEmail(user?.email || '');
  };

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim()) {
      setStatus('error');
      setResultMessage('Bitte füllen Sie Titel und Beschreibung aus.');
      return;
    }

    setLoading(true);
    setStatus('form');
    setResultMessage('');

    try {
      await createTicket({
        type,
        title: title.trim(),
        description: description.trim(),
        contactEmail: contactEmail.trim() || user?.email || undefined,
        reporterEmail: user?.email || contactEmail.trim() || undefined,
        reporterName: user?.fullName || user?.username || undefined,
        reporterId: user?.id,
        userName: user?.username || undefined,
      });

      setStatus('success');
      setResultMessage(
        type === 'bug'
          ? 'Bug-Report erfolgreich übermittelt. Vielen Dank für Ihre Mithilfe.'
          : 'Feature-Wunsch erfolgreich übermittelt. Vielen Dank für Ihren Vorschlag.'
      );
    } catch (err: any) {
      setStatus('error');
      setResultMessage(
        err.response?.data?.details ||
          err.response?.data?.error ||
          err.message ||
          'Fehler beim Senden des Tickets.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogContent sx={{ p: 0 }}>
        {status === 'form' && (
          <Box>
            <Box
              sx={{
                px: 3,
                py: 2.5,
                color: 'common.white',
                background: type === 'bug'
                  ? 'linear-gradient(135deg, #b91c1c 0%, #ef4444 100%)'
                  : 'linear-gradient(135deg, #b45309 0%, #f59e0b 100%)',
              }}
            >
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
                <Box>
                  <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 1 }}>
                    {type === 'bug' ? <BugIcon /> : <FeatureIcon />}
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>
                      {type === 'bug' ? 'Bug melden' : 'Feature vorschlagen'}
                    </Typography>
                  </Stack>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>
                    {type === 'bug'
                      ? 'Beschreiben Sie den Fehler möglichst genau. System- und Nutzerinformationen werden automatisch mitgeschickt.'
                      : 'Beschreiben Sie Ihren Verbesserungsvorschlag. System- und Nutzerinformationen werden automatisch mitgeschickt.'}
                  </Typography>
                </Box>
                <IconButton onClick={handleClose} sx={{ color: 'common.white', mt: -0.5, mr: -0.5 }}>
                  <CloseIcon />
                </IconButton>
              </Stack>
            </Box>

            <Box sx={{ p: 3 }}>
              <Stack spacing={2.5}>
                <Stack direction="row" spacing={1.5}>
                  <Button
                    fullWidth
                    variant={type === 'bug' ? 'contained' : 'outlined'}
                    color="error"
                    startIcon={<BugIcon />}
                    onClick={() => setType('bug')}
                    sx={{ py: 1.2, borderRadius: 2 }}
                  >
                    Bug
                  </Button>
                  <Button
                    fullWidth
                    variant={type === 'feature' ? 'contained' : 'outlined'}
                    color="warning"
                    startIcon={<FeatureIcon />}
                    onClick={() => setType('feature')}
                    sx={{ py: 1.2, borderRadius: 2 }}
                  >
                    Feature
                  </Button>
                </Stack>

                <TextField
                  fullWidth
                  label="Titel *"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={type === 'bug' ? 'Kurze Fehlerbeschreibung' : 'Kurze Beschreibung des Wunsches'}
                />

                <TextField
                  fullWidth
                  label="Beschreibung *"
                  multiline
                  rows={6}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={descriptionPlaceholder}
                />

                <TextField
                  fullWidth
                  label="Kontakt-E-Mail (optional)"
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="ihre@email.de"
                  helperText="Nur falls wir Rückfragen haben. Ansonsten wird die hinterlegte E-Mail verwendet."
                />

                <Box
                  sx={{
                    borderRadius: 2,
                    border: '1px solid',
                    borderColor: 'divider',
                    bgcolor: 'grey.50',
                    p: 2,
                  }}
                >
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                    <InfoIcon fontSize="small" color="action" />
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                      Automatisch übermittelte Daten
                    </Typography>
                  </Stack>
                  <Typography variant="body2" color="text.secondary">
                    Systemname, Version, URL, Benutzername, hinterlegte E-Mail, Browser, Betriebssystem und letzte Konsolen-Logs.
                  </Typography>
                </Box>

                <Divider />

                <Stack direction="row" justifyContent="flex-end" spacing={1.5}>
                  <Button onClick={handleClose} color="inherit">
                    Abbrechen
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    variant="contained"
                    disabled={loading || !title.trim() || !description.trim()}
                    startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <SendIcon />}
                    sx={{ minWidth: 190, borderRadius: 2 }}
                  >
                    {loading ? 'Wird gesendet...' : type === 'bug' ? 'Bug melden' : 'Feature vorschlagen'}
                  </Button>
                </Stack>
              </Stack>
            </Box>
          </Box>
        )}

        {status === 'success' && (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <SuccessIcon color="success" sx={{ fontSize: 64, mb: 2 }} />
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
              Erfolgreich übermittelt
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3, whiteSpace: 'pre-line' }}>
              {resultMessage}
            </Typography>
            <Button variant="contained" onClick={handleClose}>
              Schließen
            </Button>
          </Box>
        )}

        {status === 'error' && (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <ErrorIcon color="error" sx={{ fontSize: 64, mb: 2 }} />
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
              Übermittlung fehlgeschlagen
            </Typography>
            <Alert severity="error" sx={{ textAlign: 'left', mb: 3 }}>
              {resultMessage}
            </Alert>
            <Stack direction="row" justifyContent="center" spacing={1.5}>
              <Button variant="outlined" onClick={handleClose}>
                Schließen
              </Button>
              <Button variant="contained" startIcon={<RetryIcon />} onClick={() => setStatus('form')}>
                Erneut versuchen
              </Button>
            </Stack>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
}
