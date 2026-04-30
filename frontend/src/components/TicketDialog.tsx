import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  CircularProgress,
  Alert,
  IconButton,
} from '@mui/material';
import {
  Close as CloseIcon,
  CloudUpload as CloudUploadIcon,
} from '@mui/icons-material';
import { createTicket, TicketData } from '../services/ticketService';

interface TicketDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function TicketDialog({ open, onClose }: TicketDialogProps) {
  const [type, setType] = useState<'Bug' | 'Feature'>('Bug');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    if (!subject.trim() || !description.trim()) {
      setError('Bitte füllen Sie Betreff und Beschreibung aus.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const screenshotBase64 = screenshot ? await fileToBase64(screenshot) : undefined;
      await createTicket({ type, subject, description, screenshot: screenshotBase64 });
      setSuccess(true);
      setType('Bug');
      setSubject('');
      setDescription('');
      setScreenshot(null);
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 2000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Fehler beim Senden des Tickets.');
    } finally {
      setLoading(false);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  const handleClose = () => {
    onClose();
    setError(null);
    setSuccess(false);
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        Feedback & Verbesserungen
        <IconButton
          onClick={handleClose}
          sx={{ position: 'absolute', right: 8, top: 8 }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {success && <Alert severity="success">Ticket erfolgreich gesendet!</Alert>}
        {error && <Alert severity="error">{error}</Alert>}
        <FormControl fullWidth sx={{ mt: 1, mb: 2 }}>
          <InputLabel>Typ</InputLabel>
          <Select
            value={type}
            onChange={(e) => setType(e.target.value as 'Bug' | 'Feature')}
            label="Typ"
          >
            <MenuItem value="Bug">Bug melden</MenuItem>
            <MenuItem value="Feature">Verbesserung vorschlagen</MenuItem>
          </Select>
        </FormControl>
        <TextField
          fullWidth
          label="Betreff"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          sx={{ mb: 2 }}
          required
        />
        <TextField
          fullWidth
          label="Beschreibung"
          multiline
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          sx={{ mb: 2 }}
          required
        />
        <Button
          variant="outlined"
          component="label"
          startIcon={<CloudUploadIcon />}
          fullWidth
        >
          {screenshot ? screenshot.name : 'Screenshot hochladen (optional)'}
          <input
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                setScreenshot(e.target.files[0]);
              }
            }}
          />
        </Button>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Abbrechen</Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={loading}
          startIcon={loading ? <CircularProgress size={20} /> : null}
        >
          Senden
        </Button>
      </DialogActions>
    </Dialog>
  );
}
