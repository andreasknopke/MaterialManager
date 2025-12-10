import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { Box } from '@mui/material';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Materials from './pages/Materials';
import MaterialDetail from './pages/MaterialDetail';
import MaterialForm from './pages/MaterialForm';
import Cabinets from './pages/Cabinets';
import Categories from './pages/Categories';
import Companies from './pages/Companies';
import BarcodeScanner from './pages/BarcodeScanner';
import Reports from './pages/Reports';

function App() {
  return (
    <Box>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/materials" element={<Materials />} />
          <Route path="/materials/new" element={<MaterialForm />} />
          <Route path="/materials/:id/edit" element={<MaterialForm />} />
          <Route path="/materials/:id" element={<MaterialDetail />} />
          <Route path="/cabinets" element={<Cabinets />} />
          <Route path="/categories" element={<Categories />} />
          <Route path="/companies" element={<Companies />} />
          <Route path="/scanner" element={<BarcodeScanner />} />
          <Route path="/reports" element={<Reports />} />
        </Routes>
      </Layout>
    </Box>
  );
}

export default App;
