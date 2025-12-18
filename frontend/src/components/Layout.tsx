import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  AppBar,
  Box,
  CssBaseline,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  Divider,
  Menu,
  MenuItem,
  Avatar,
  Chip,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  Inventory as InventoryIcon,
  Category as CategoryIcon,
  Business as BusinessIcon,
  QrCodeScanner as QrCodeScannerIcon,
  Assessment as AssessmentIcon,
  Storage as StorageIcon,
  Checklist as ChecklistIcon,
  Settings as SettingsIcon,
  AccountCircle,
  Logout as LogoutIcon,
  Lock as LockIcon,
  People as PeopleIcon,
  Analytics as AnalyticsIcon,
  LocalHospital as HospitalIcon,
  ShoppingCart as ShoppingCartIcon,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import ChangePasswordDialog from './ChangePasswordDialog';
import OfflineIndicator from './OfflineIndicator';

const drawerWidth = 240;

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, isAdmin } = useAuth();

  // Automatisch Passwort-Dialog öffnen wenn mustChangePassword true ist
  useEffect(() => {
    if (user?.mustChangePassword && !passwordDialogOpen) {
      setPasswordDialogOpen(true);
    }
  }, [user?.mustChangePassword]);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleChangePassword = () => {
    setPasswordDialogOpen(true);
    handleMenuClose();
  };

  const menuItems = [
    { text: 'Dashboard', icon: <DashboardIcon />, path: '/' },
    { text: 'Materialien', icon: <InventoryIcon />, path: '/materials' },
    { text: 'Schränke', icon: <StorageIcon />, path: '/cabinets' },
    { text: 'Inventur', icon: <ChecklistIcon />, path: '/inventory' },
    { text: 'Interventionen', icon: <HospitalIcon />, path: '/interventions' },
    { text: 'Nachbestellung', icon: <ShoppingCartIcon />, path: '/reorder' },
    { text: 'Einheiten', icon: <BusinessIcon />, path: '/units' },
    { text: 'Kategorien', icon: <CategoryIcon />, path: '/categories' },
    { text: 'Firmen', icon: <BusinessIcon />, path: '/companies' },
    { text: 'Berichte', icon: <AssessmentIcon />, path: '/reports' },
    { text: 'Statistiken', icon: <AnalyticsIcon />, path: '/statistics' },
  ];

  const adminItems = [
    { text: 'Administration', icon: <SettingsIcon />, path: '/admin' },
    ...(isAdmin ? [{ text: 'Benutzerverwaltung', icon: <PeopleIcon />, path: '/users' }] : []),
  ];

  const drawer = (
    <div>
      <Toolbar>
        <Typography variant="h6" noWrap component="div">
          Material Manager
        </Typography>
      </Toolbar>
      <Divider />
      <List>
        {menuItems.map((item) => (
          <ListItem key={item.text} disablePadding>
            <ListItemButton
              selected={location.pathname === item.path}
              onClick={() => {
                navigate(item.path);
                setMobileOpen(false);
              }}
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.text} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
      <Divider />
      <List>
        {adminItems.map((item) => (
          <ListItem key={item.text} disablePadding>
            <ListItemButton
              selected={location.pathname === item.path}
              onClick={() => {
                navigate(item.path);
                setMobileOpen(false);
              }}
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.text} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </div>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />
      <AppBar
        position="fixed"
        sx={{
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          ml: { sm: `${drawerWidth}px` },
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { sm: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            Angiographie Material Management
          </Typography>
          
          {/* User Menu */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {user?.mustChangePassword && (
              <Chip
                label="Passwort ändern!"
                color="warning"
                size="small"
                sx={{ mr: 1, cursor: 'pointer' }}
                onClick={handleChangePassword}
                icon={<LockIcon />}
              />
            )}
            
            {/* Offline-Indikator */}
            <OfflineIndicator />
            
            <Typography variant="body2" sx={{ mr: 1, display: { xs: 'none', md: 'block' } }}>
              {user?.username}
            </Typography>
            <IconButton
              onClick={handleMenuOpen}
              size="small"
              sx={{ ml: 2 }}
              aria-controls="account-menu"
              aria-haspopup="true"
            >
              <Avatar sx={{ width: 32, height: 32, bgcolor: 'secondary.main' }}>
                {user?.username.charAt(0).toUpperCase()}
              </Avatar>
            </IconButton>
            <Menu
              id="account-menu"
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={handleMenuClose}
              onClick={handleMenuClose}
            >
              <MenuItem disabled>
                <ListItemIcon>
                  <AccountCircle fontSize="small" />
                </ListItemIcon>
                <ListItemText>
                  <Typography variant="body2">{user?.username}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {user?.email}
                  </Typography>
                </ListItemText>
              </MenuItem>
              <Divider />
              <MenuItem onClick={handleChangePassword}>
                <ListItemIcon>
                  <LockIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>Passwort ändern</ListItemText>
              </MenuItem>
              <MenuItem onClick={handleLogout}>
                <ListItemIcon>
                  <LogoutIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>Abmelden</ListItemText>
              </MenuItem>
            </Menu>
          </Box>
        </Toolbar>
      </AppBar>
      <Box
        component="nav"
        sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true,
          }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: drawerWidth,
            },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: drawerWidth,
            },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 2, sm: 3 },
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          overflowX: 'auto',
        }}
      >
        <Toolbar />
        {children}
      </Box>
      
      {/* Change Password Dialog */}
      <ChangePasswordDialog
        open={passwordDialogOpen}
        onClose={() => setPasswordDialogOpen(false)}
        onSuccess={() => {
          // Optional: Update user info or show success message
        }}
      />
    </Box>
  );
};

export default Layout;
