import axios from 'axios';

// Bestimme API-URL basierend auf Umgebung
const getApiBaseUrl = () => {
  // Prüfe ob wir auf Railway Production sind
  if (window.location.hostname.includes('railway.app')) {
    return 'https://materialmanager-production.up.railway.app/api';
  }
  // Lokal: nutze relativen Pfad (Vite Proxy)
  return '/api';
};

const API_BASE_URL = getApiBaseUrl();

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor - fügt Auth-Token zu allen Requests hinzu
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response Interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

export default api;

// API Endpoints

// Cabinets
export const cabinetAPI = {
  getAll: () => api.get('/cabinets'),
  getById: (id: number) => api.get(`/cabinets/${id}`),
  getMaterials: (id: number) => api.get(`/cabinets/${id}/materials`),
  create: (data: any) => api.post('/cabinets', data),
  update: (id: number, data: any) => api.put(`/cabinets/${id}`, data),
  delete: (id: number) => api.delete(`/cabinets/${id}`),
};

// Materials
export const materialAPI = {
  getAll: (params?: any) => api.get('/materials', { params }),
  getById: (id: number) => api.get(`/materials/${id}`),
  getTransactions: (id: number) => api.get(`/materials/${id}/transactions`),
  create: (data: any) => api.post('/materials', data),
  update: (id: number, data: any) => api.put(`/materials/${id}`, data),
  delete: (id: number) => api.delete(`/materials/${id}`),
  reactivate: (id: number) => api.post(`/materials/${id}/reactivate`),
  stockIn: (id: number, data: any) => api.post(`/materials/${id}/stock-in`, data),
  stockOut: (id: number, data: any) => api.post(`/materials/${id}/stock-out`, data),
  getExpiring: () => api.get('/materials/reports/expiring'),
  getLowStock: () => api.get('/materials/reports/low-stock'),
};

// Categories
export const categoryAPI = {
  getAll: () => api.get('/categories'),
  getById: (id: number) => api.get(`/categories/${id}`),
  getInventoryStats: () => api.get('/categories/stats/inventory'),
  create: (data: any) => api.post('/categories', data),
  update: (id: number, data: any) => api.put(`/categories/${id}`, data),
  delete: (id: number) => api.delete(`/categories/${id}`),
};

// Companies
export const companyAPI = {
  getAll: () => api.get('/companies'),
  getById: (id: number) => api.get(`/companies/${id}`),
  create: (data: any) => api.post('/companies', data),
  update: (id: number, data: any) => api.put(`/companies/${id}`, data),
  delete: (id: number) => api.delete(`/companies/${id}`),
};

// Barcodes
export const barcodeAPI = {
  search: (barcode: string) => api.get(`/barcodes/search/${barcode}`),
  getByMaterial: (materialId: number) => api.get(`/barcodes/material/${materialId}`),
  create: (data: any) => api.post('/barcodes', data),
  update: (id: number, data: any) => api.put(`/barcodes/${id}`, data),
  delete: (id: number) => api.delete(`/barcodes/${id}`),
  scanOut: (data: any) => api.post('/barcodes/scan-out', data),
};

// Field Configurations
export const fieldConfigAPI = {
  getAll: () => api.get('/field-configs'),
  getById: (id: number) => api.get(`/field-configs/${id}`),
  create: (data: any) => api.post('/field-configs', data),
  update: (id: number, data: any) => api.put(`/field-configs/${id}`, data),
  delete: (id: number) => api.delete(`/field-configs/${id}`),
};

// Units
export const unitAPI = {
  getAll: (params?: any) => api.get('/units', { params }),
  getById: (id: number) => api.get(`/units/${id}`),
  getStats: (id: number) => api.get(`/units/${id}/stats`),
  getTransfers: (id: number, params?: any) => api.get(`/units/${id}/transfers`, { params }),
  create: (data: any) => api.post('/units', data),
  update: (id: number, data: any) => api.put(`/units/${id}`, data),
  delete: (id: number) => api.delete(`/units/${id}`),
};
