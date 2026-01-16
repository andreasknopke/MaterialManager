import React, { useEffect, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import { AuthProvider } from './contexts/AuthContext';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Materials from './pages/Materials';
import MaterialDetail from './pages/MaterialDetail';
import MaterialForm from './pages/MaterialForm';
import Cabinets from './pages/Cabinets';
import Categories from './pages/Categories';
import Companies from './pages/Companies';
import BarcodeScanner from './pages/BarcodeScanner';
import Reports from './pages/Reports';
import Statistics from './pages/Statistics';
import Inventory from './pages/Inventory';
import Search from './pages/Search';
import Admin from './pages/Admin';
import Units from './pages/Units';
import Users from './pages/Users';
import InterventionProtocols from './pages/InterventionProtocols';
import PatientAssignment from './pages/PatientAssignment';
import Reorder from './pages/Reorder';
import AuditLogs from './pages/AuditLogs';
import { extractAndSaveDbTokenFromUrl, syncDbTokenFromIndexedDB } from './utils/dbToken';

// Globaler Loading-Fallback für initiale Ladephase
const AppLoadingFallback = () => (
  <Box
    sx={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      bgcolor: 'background.default',
    }}
  >
    <CircularProgress size={48} />
  </Box>
);

function App() {
  // Bei App-Start: DB-Token aus IndexedDB laden und aus URL extrahieren
  useEffect(() => {
    // Zuerst IndexedDB mit localStorage synchronisieren (für PWA)
    syncDbTokenFromIndexedDB().then(() => {
      // Dann prüfen ob Token in URL vorhanden
      extractAndSaveDbTokenFromUrl();
    });
  }, []);

  return (
    <AuthProvider>
      <Box>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Protected Routes */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout>
                  <Dashboard />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/materials"
            element={
              <ProtectedRoute>
                <Layout>
                  <Materials />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/materials/new"
            element={
              <ProtectedRoute>
                <Layout>
                  <MaterialForm key="new" />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/materials/:id/edit"
            element={
              <ProtectedRoute>
                <Layout>
                  <MaterialForm key="edit" />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/materials/:id"
            element={
              <ProtectedRoute>
                <Layout>
                  <MaterialDetail />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/cabinets"
            element={
              <ProtectedRoute>
                <Layout>
                  <Cabinets />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/categories"
            element={
              <ProtectedRoute>
                <Layout>
                  <Categories />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/companies"
            element={
              <ProtectedRoute>
                <Layout>
                  <Companies />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/units"
            element={
              <ProtectedRoute>
                <Layout>
                  <Units />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/scanner"
            element={
              <ProtectedRoute>
                <Layout>
                  <BarcodeScanner />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports"
            element={
              <ProtectedRoute>
                <Layout>
                  <Reports />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/inventory"
            element={
              <ProtectedRoute>
                <Layout>
                  <Inventory />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/search"
            element={
              <ProtectedRoute>
                <Layout>
                  <Search />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/statistics"
            element={
              <ProtectedRoute>
                <Layout>
                  <Statistics />
                </Layout>
              </ProtectedRoute>
            }
          />
          
          {/* Admin Routes */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute requireAdmin>
                <Layout>
                  <Admin />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/users"
            element={
              <ProtectedRoute requireAdmin>
                <Layout>
                  <Users />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/audit-logs"
            element={
              <ProtectedRoute requireAdmin>
                <Layout>
                  <AuditLogs />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/interventions"
            element={
              <ProtectedRoute>
                <Layout>
                  <InterventionProtocols />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/patient-assignment"
            element={
              <ProtectedRoute>
                <Layout>
                  <PatientAssignment />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/reorder"
            element={
              <ProtectedRoute>
                <Layout>
                  <Reorder />
                </Layout>
              </ProtectedRoute>
            }
          />
        </Routes>
      </Box>
    </AuthProvider>
  );
}

export default App;
