import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Tooltip,
} from '@mui/material';
import {
  PersonAdd as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  AdminPanelSettings as AdminIcon,
  Person as UserIcon,
  Visibility as ViewerIcon,
  Shield as RootIcon,
} from '@mui/icons-material';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

interface User {
  id: number;
  username: string;
  email: string;
  full_name?: string;
  role: 'admin' | 'user' | 'viewer';
  is_root: boolean;
  department_id?: number | null;
  department_name?: string;
  department_color?: string;
  active: boolean;
  email_verified: boolean;
  must_change_password: boolean;
  last_login?: string;
  created_at: string;
}

interface Department {
  id: number;
  name: string;
  color: string;
}

const Users: React.FC = () => {
  const { isRoot, user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Dialog-Zustände
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Formular-Daten
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    fullName: '',
    role: 'user' as 'admin' | 'user' | 'viewer',
    departmentId: null as number | null,
  });

  useEffect(() => {
    loadUsers();
    loadDepartments();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/users');
      setUsers(response.data);
    } catch (err: any) {
      setError('Fehler beim Laden der Benutzer');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadDepartments = async () => {
    try {
      const response = await axios.get('/api/units');
      setDepartments(response.data);
    } catch (err: any) {
      console.error('Fehler beim Laden der Departments:', err);
    }
  };

  const handleCreateUser = async () => {
    try {
      await axios.post('/api/users', formData);
      setSuccess('Benutzer erfolgreich erstellt');
      setCreateDialogOpen(false);
      resetForm();
      loadUsers();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Fehler beim Erstellen des Benutzers');
    }
  };

  const handleUpdateUser = async () => {
    if (!selectedUser) return;

    try {
      await axios.put(`/api/users/${selectedUser.id}`, {
        username: formData.username,
        fullName: formData.fullName,
        email: formData.email,
        role: formData.role,
        departmentId: formData.departmentId,
      });
      setSuccess('Benutzer erfolgreich aktualisiert');
      setEditDialogOpen(false);
      setSelectedUser(null);
      resetForm();
      loadUsers();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Fehler beim Aktualisieren des Benutzers');
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;

    try {
      await axios.delete(`/api/users/${selectedUser.id}`);
      setSuccess('Benutzer erfolgreich gelöscht');
      setDeleteDialogOpen(false);
      setSelectedUser(null);
      loadUsers();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Fehler beim Löschen des Benutzers');
    }
  };

  const handleMakeAdmin = async (userId: number) => {
    try {
      await axios.post(`/api/users/${userId}/make-admin`);
      setSuccess('Benutzer ist jetzt Administrator');
      loadUsers();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Fehler beim Ändern der Rolle');
    }
  };

  const handleRemoveAdmin = async (userId: number) => {
    try {
      await axios.post(`/api/users/${userId}/remove-admin`);
      setSuccess('Admin-Rechte wurden entfernt');
      loadUsers();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Fehler beim Ändern der Rolle');
    }
  };

  const resetForm = () => {
    setFormData({
      username: '',
      email: '',
      password: '',
      fullName: '',
      role: 'user',
      departmentId: null,
    });
  };

  const openEditDialog = (user: User) => {
    setSelectedUser(user);
    setFormData({
      username: user.username,
      email: user.email,
      password: '',
      fullName: user.full_name || '',
      role: user.role,
      departmentId: user.department_id || null,
    });
    setEditDialogOpen(true);
  };

  const openDeleteDialog = (user: User) => {
    setSelectedUser(user);
    setDeleteDialogOpen(true);
  };

  const getRoleIcon = (role: string, isRoot: boolean) => {
    if (isRoot) return <RootIcon fontSize="small" />;
    switch (role) {
      case 'admin':
        return <AdminIcon fontSize="small" />;
      case 'viewer':
        return <ViewerIcon fontSize="small" />;
      default:
        return <UserIcon fontSize="small" />;
    }
  };

  const getRoleColor = (role: string, isRoot: boolean): any => {
    if (isRoot) return 'error';
    switch (role) {
      case 'admin':
        return 'primary';
      case 'viewer':
        return 'default';
      default:
        return 'success';
    }
  };

  const getRoleLabel = (role: string, isRoot: boolean) => {
    if (isRoot) return 'ROOT';
    return role.toUpperCase();
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Benutzerverwaltung</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setCreateDialogOpen(true)}
        >
          Neuer Benutzer
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Benutzername</TableCell>
              <TableCell>E-Mail</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Rolle</TableCell>
              <TableCell>Department</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Letzter Login</TableCell>
              <TableCell align="right">Aktionen</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell>
                  <Box display="flex" alignItems="center" gap={1}>
                    {user.is_root && <RootIcon fontSize="small" color="error" />}
                    {user.username}
                  </Box>
                </TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>{user.full_name || '-'}</TableCell>
                <TableCell>
                  <Chip
                    icon={getRoleIcon(user.role, user.is_root)}
                    label={getRoleLabel(user.role, user.is_root)}
                    color={getRoleColor(user.role, user.is_root)}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  {user.department_name ? (
                    <Chip
                      label={user.department_name}
                      size="small"
                      sx={{
                        bgcolor: user.department_color || '#1976d2',
                        color: 'white',
                      }}
                    />
                  ) : (
                    user.is_root ? <Chip label="Alle" size="small" color="default" /> : '-'
                  )}
                </TableCell>
                <TableCell>
                  <Box display="flex" gap={0.5}>
                    {!user.active && <Chip label="Inaktiv" size="small" color="error" />}
                    {!user.email_verified && <Chip label="Nicht verifiziert" size="small" color="warning" />}
                    {user.must_change_password && <Chip label="Passwort ändern" size="small" color="info" />}
                  </Box>
                </TableCell>
                <TableCell>
                  {user.last_login
                    ? new Date(user.last_login).toLocaleDateString('de-DE')
                    : 'Nie'}
                </TableCell>
                <TableCell align="right">
                  <Tooltip title="Bearbeiten">
                    <IconButton
                      size="small"
                      onClick={() => openEditDialog(user)}
                      disabled={user.is_root && !isRoot}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  {isRoot && !user.is_root && (
                    <>
                      {user.role === 'admin' ? (
                        <Tooltip title="Admin-Rechte entfernen">
                          <IconButton
                            size="small"
                            onClick={() => handleRemoveAdmin(user.id)}
                          >
                            <UserIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      ) : (
                        <Tooltip title="Zum Admin machen">
                          <IconButton
                            size="small"
                            onClick={() => handleMakeAdmin(user.id)}
                          >
                            <AdminIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </>
                  )}
                  <Tooltip title="Löschen">
                    <span>
                      <IconButton
                        size="small"
                        onClick={() => openDeleteDialog(user)}
                        disabled={user.is_root}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Neuer Benutzer</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Benutzername"
            margin="normal"
            value={formData.username}
            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
          />
          <TextField
            fullWidth
            label="E-Mail"
            type="email"
            margin="normal"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          />
          <TextField
            fullWidth
            label="Vollständiger Name"
            margin="normal"
            value={formData.fullName}
            onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
          />
          <TextField
            fullWidth
            label="Passwort"
            type="password"
            margin="normal"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
          />
          <FormControl fullWidth margin="normal">
            <InputLabel>Rolle</InputLabel>
            <Select
              value={formData.role}
              label="Rolle"
              onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
            >
              <MenuItem value="user">User</MenuItem>
              <MenuItem value="admin">Admin</MenuItem>
              <MenuItem value="viewer">Viewer</MenuItem>
            </Select>
          </FormControl>
          <FormControl fullWidth margin="normal">
            <InputLabel>Department</InputLabel>
            <Select
              value={formData.departmentId || ''}
              label="Department"
              onChange={(e) => setFormData({ ...formData, departmentId: e.target.value ? Number(e.target.value) : null })}
              disabled={!isRoot}
            >
              <MenuItem value="">
                <em>Kein Department (Root)</em>
              </MenuItem>
              {departments.map((dept) => (
                <MenuItem key={dept.id} value={dept.id}>
                  {dept.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Abbrechen</Button>
          <Button onClick={handleCreateUser} variant="contained">
            Erstellen
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Benutzer bearbeiten</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Benutzername"
            margin="normal"
            value={formData.username}
            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
          />
          <TextField
            fullWidth
            label="E-Mail"
            type="email"
            margin="normal"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          />
          <TextField
            fullWidth
            label="Vollständiger Name"
            margin="normal"
            value={formData.fullName}
            onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
          />
          <FormControl fullWidth margin="normal">
            <InputLabel>Rolle</InputLabel>
            <Select
              value={formData.role}
              label="Rolle"
              onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
            >
              <MenuItem value="user">User</MenuItem>
              <MenuItem value="admin">Admin</MenuItem>
              <MenuItem value="viewer">Viewer</MenuItem>
            </Select>
          </FormControl>
          <FormControl fullWidth margin="normal">
            <InputLabel>Department</InputLabel>
            <Select
              value={formData.departmentId || ''}
              label="Department"
              onChange={(e) => setFormData({ ...formData, departmentId: e.target.value ? Number(e.target.value) : null })}
              disabled={!isRoot}
            >
              <MenuItem value="">
                <em>Kein Department (Root)</em>
              </MenuItem>
              {departments.map((dept) => (
                <MenuItem key={dept.id} value={dept.id}>
                  {dept.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Abbrechen</Button>
          <Button onClick={handleUpdateUser} variant="contained">
            Speichern
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Benutzer löschen?</DialogTitle>
        <DialogContent>
          <Typography>
            Möchten Sie den Benutzer <strong>{selectedUser?.username}</strong> wirklich löschen?
          </Typography>
          <Alert severity="warning" sx={{ mt: 2 }}>
            Diese Aktion kann nicht rückgängig gemacht werden.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Abbrechen</Button>
          <Button onClick={handleDeleteUser} variant="contained" color="error">
            Löschen
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Users;
