import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  TextField,
  Button,
  Typography,
  Alert,
  Link,
  InputAdornment,
  IconButton,
  CircularProgress,
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  PersonAdd as RegisterIcon,
  CheckCircle as SuccessIcon,
} from '@mui/icons-material';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Register: React.FC = () => {
  const navigate = useNavigate();
  const { register, loading: authLoading, isAuthenticated } = useAuth();

  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Redirect wenn bereits eingeloggt
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [authLoading, isAuthenticated, navigate]);

  // Zeige Loading-Spinner während Auth-Status geprüft wird
  if (authLoading) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'background.default',
        }}
      >
        <CircularProgress size={48} />
      </Box>
    );
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const validateForm = (): boolean => {
    if (!formData.username || !formData.email || !formData.password) {
      setError('Bitte füllen Sie alle Pflichtfelder aus');
      return false;
    }

    if (formData.username.length < 3) {
      setError('Benutzername muss mindestens 3 Zeichen lang sein');
      return false;
    }

    if (!formData.email.includes('@')) {
      setError('Bitte geben Sie eine gültige E-Mail-Adresse ein');
      return false;
    }

    if (formData.password.length < 6) {
      setError('Passwort muss mindestens 6 Zeichen lang sein');
      return false;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwörter stimmen nicht überein');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      await register(
        formData.username,
        formData.email,
        formData.password,
        formData.fullName || undefined
      );
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Registrierung fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'background.default',
          p: 2,
        }}
      >
        <Paper
          elevation={3}
          sx={{
            p: 4,
            maxWidth: 500,
            width: '100%',
            textAlign: 'center',
          }}
        >
          <SuccessIcon sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
          <Typography variant="h5" gutterBottom>
            Registrierung erfolgreich!
          </Typography>
          <Typography variant="body1" color="text.secondary" paragraph>
            Wir haben Ihnen eine E-Mail zur Verifizierung Ihrer E-Mail-Adresse gesendet.
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            Bitte überprüfen Sie Ihr Postfach und klicken Sie auf den Bestätigungslink,
            um Ihr Konto zu aktivieren.
          </Typography>
          <Button
            component={RouterLink}
            to="/login"
            variant="contained"
            size="large"
            sx={{ mt: 2 }}
          >
            Zur Anmeldung
          </Button>
        </Paper>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
        p: 2,
      }}
    >
      <Paper
        elevation={3}
        sx={{
          p: 4,
          maxWidth: 500,
          width: '100%',
        }}
      >
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <RegisterIcon sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
          <Typography variant="h4" gutterBottom>
            Registrierung
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Erstellen Sie ein neues Konto
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Alert severity="info" sx={{ mb: 2 }}>
          Nach der Registrierung müssen Sie Ihre E-Mail-Adresse verifizieren.
        </Alert>

        <form onSubmit={handleSubmit}>
          <TextField
            fullWidth
            label="Benutzername *"
            name="username"
            variant="outlined"
            margin="normal"
            value={formData.username}
            onChange={handleChange}
            autoComplete="username"
            autoFocus
            disabled={loading}
            helperText="Mindestens 3 Zeichen"
          />

          <TextField
            fullWidth
            label="E-Mail-Adresse *"
            name="email"
            type="email"
            variant="outlined"
            margin="normal"
            value={formData.email}
            onChange={handleChange}
            autoComplete="email"
            disabled={loading}
          />

          <TextField
            fullWidth
            label="Vollständiger Name (optional)"
            name="fullName"
            variant="outlined"
            margin="normal"
            value={formData.fullName}
            onChange={handleChange}
            autoComplete="name"
            disabled={loading}
          />

          <TextField
            fullWidth
            label="Passwort *"
            name="password"
            type={showPassword ? 'text' : 'password'}
            variant="outlined"
            margin="normal"
            value={formData.password}
            onChange={handleChange}
            autoComplete="new-password"
            disabled={loading}
            helperText="Mindestens 6 Zeichen"
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    onClick={() => setShowPassword(!showPassword)}
                    edge="end"
                  >
                    {showPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />

          <TextField
            fullWidth
            label="Passwort bestätigen *"
            name="confirmPassword"
            type={showPassword ? 'text' : 'password'}
            variant="outlined"
            margin="normal"
            value={formData.confirmPassword}
            onChange={handleChange}
            autoComplete="new-password"
            disabled={loading}
            error={formData.confirmPassword !== '' && formData.password !== formData.confirmPassword}
            helperText={
              formData.confirmPassword !== '' && formData.password !== formData.confirmPassword
                ? 'Passwörter stimmen nicht überein'
                : ''
            }
          />

          <Button
            type="submit"
            fullWidth
            variant="contained"
            size="large"
            sx={{ mt: 3, mb: 2 }}
            disabled={loading}
            startIcon={loading ? <CircularProgress size={20} /> : <RegisterIcon />}
          >
            {loading ? 'Registrierung läuft...' : 'Registrieren'}
          </Button>

          <Box sx={{ textAlign: 'center', mt: 2 }}>
            <Link component={RouterLink} to="/login" variant="body2">
              Bereits registriert? Jetzt anmelden
            </Link>
          </Box>
        </form>
      </Paper>
    </Box>
  );
};

export default Register;
