import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Alert,
  InputAdornment,
  IconButton,
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
} from '@mui/icons-material';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

interface ChangePasswordDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const ChangePasswordDialog: React.FC<ChangePasswordDialogProps> = ({
  open,
  onClose,
  onSuccess,
}) => {
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showPasswords, setShowPasswords] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { user, updateUser } = useAuth();
  
  // Prüfe ob Passwortänderung erzwungen wird
  const isForced = user?.mustChangePassword || false;

  const handleClose = () => {
    // Nicht schließbar wenn Passwortänderung erzwungen wird
    if (isForced) {
      return;
    }
    
    setFormData({
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    });
    setError(null);
    onClose();
  };

  const validateForm = (): boolean => {
    if (!formData.currentPassword || !formData.newPassword || !formData.confirmPassword) {
      setError('Bitte füllen Sie alle Felder aus');
      return false;
    }

    if (formData.newPassword.length < 6) {
      setError('Das neue Passwort muss mindestens 6 Zeichen lang sein');
      return false;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      setError('Die neuen Passwörter stimmen nicht überein');
      return false;
    }

    if (formData.currentPassword === formData.newPassword) {
      setError('Das neue Passwort muss sich vom aktuellen unterscheiden');
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    setError(null);

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      await axios.post('/api/auth/change-password', {
        currentPassword: formData.currentPassword,
        newPassword: formData.newPassword,
      });

      // Update user state um mustChangePassword zu entfernen
      if (user && updateUser) {
        updateUser({ ...user, mustChangePassword: false });
      }

      handleClose();
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Fehler beim Ändern des Passworts');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleClose} 
      maxWidth="sm" 
      fullWidth
      disableEscapeKeyDown={isForced}
    >
      <DialogTitle>
        {isForced ? 'Passwort muss geändert werden' : 'Passwort ändern'}
      </DialogTitle>
      <DialogContent>
        {isForced && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Aus Sicherheitsgründen müssen Sie Ihr Passwort ändern, bevor Sie fortfahren können.
          </Alert>
        )}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <TextField
          fullWidth
          label="Aktuelles Passwort"
          type={showPasswords ? 'text' : 'password'}
          margin="normal"
          value={formData.currentPassword}
          onChange={(e) =>
            setFormData({ ...formData, currentPassword: e.target.value })
          }
          autoComplete="current-password"
          disabled={loading}
        />

        <TextField
          fullWidth
          label="Neues Passwort"
          type={showPasswords ? 'text' : 'password'}
          margin="normal"
          value={formData.newPassword}
          onChange={(e) =>
            setFormData({ ...formData, newPassword: e.target.value })
          }
          autoComplete="new-password"
          disabled={loading}
          helperText="Mindestens 6 Zeichen"
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  onClick={() => setShowPasswords(!showPasswords)}
                  edge="end"
                >
                  {showPasswords ? <VisibilityOff /> : <Visibility />}
                </IconButton>
              </InputAdornment>
            ),
          }}
        />

        <TextField
          fullWidth
          label="Neues Passwort bestätigen"
          type={showPasswords ? 'text' : 'password'}
          margin="normal"
          value={formData.confirmPassword}
          onChange={(e) =>
            setFormData({ ...formData, confirmPassword: e.target.value })
          }
          autoComplete="new-password"
          disabled={loading}
          error={
            formData.confirmPassword !== '' &&
            formData.newPassword !== formData.confirmPassword
          }
          helperText={
            formData.confirmPassword !== '' &&
            formData.newPassword !== formData.confirmPassword
              ? 'Passwörter stimmen nicht überein'
              : ''
          }
        />
      </DialogContent>
      <DialogActions>
        {!isForced && (
          <Button onClick={handleClose} disabled={loading}>
            Abbrechen
          </Button>
        )}
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={loading}
        >
          {loading ? 'Wird geändert...' : 'Passwort ändern'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ChangePasswordDialog;
