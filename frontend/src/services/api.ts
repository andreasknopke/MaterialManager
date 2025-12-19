import axios from 'axios';
import { getDbToken } from '../utils/dbToken';
import offlineStorage from './offlineStorage';

// Use relative URL for API calls - nginx will proxy to backend
const API_BASE_URL = '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor - Token automatisch hinzufügen
api.interceptors.request.use(
  (config) => {
    // Auth Token
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // DB Token (für dynamische Datenbank-Verbindung)
    const dbToken = getDbToken();
    if (dbToken) {
      config.headers['X-DB-Token'] = dbToken;
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response Interceptor mit Offline-Unterstützung
api.interceptors.response.use(
  (response) => {
    // Erfolgreiche GET-Requests cachen
    if (response.config.method === 'get' && response.status === 200) {
      const cacheKey = response.config.url || '';
      if (cacheKey && shouldCache(cacheKey)) {
        offlineStorage.cacheData(cacheKey, response.data);
      }
    }
    return response;
  },
  async (error) => {
    // Bei Netzwerk-Fehler: Versuche aus Cache zu laden (GET) oder Queue (POST/PUT/DELETE)
    if (!error.response && !navigator.onLine) {
      const config = error.config;
      
      if (config.method === 'get') {
        // Versuche gecachte Daten zurückzugeben
        const cacheKey = config.url;
        const cachedData = await offlineStorage.getCachedData(cacheKey);
        
        if (cachedData) {
          console.log('[API] Returning cached data for:', cacheKey);
          return {
            data: cachedData,
            status: 200,
            statusText: 'OK (cached)',
            headers: { 'x-from-cache': 'true', 'x-offline-mode': 'true' },
            config
          };
        }
      } else if (['post', 'put', 'delete'].includes(config.method || '')) {
        // Änderungen in Queue speichern
        await offlineStorage.addPendingChange({
          url: `${API_BASE_URL}${config.url}`,
          method: config.method?.toUpperCase() || 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': config.headers.Authorization || '',
            'X-DB-Token': config.headers['X-DB-Token'] || ''
          },
          body: config.data || ''
        });
        
        // Erfolg simulieren für Offline-Betrieb
        return {
          data: { 
            message: 'Änderung wird bei Verbindung synchronisiert',
            offline: true,
            queued: true 
          },
          status: 202,
          statusText: 'Accepted (offline)',
          headers: { 'x-offline-mode': 'true' },
          config
        };
      }
    }
    
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

// Bestimme, welche Routen gecacht werden sollen
function shouldCache(url: string): boolean {
  const cacheableRoutes = [
    '/cabinets',
    '/materials',
    '/categories',
    '/companies',
    '/units'
  ];
  return cacheableRoutes.some(route => url.includes(route));
}

export default api;

// API Endpoints

// Cabinets
export const cabinetAPI = {
  getAll: () => api.get('/cabinets'),
  getById: (id: number) => api.get(`/cabinets/${id}`),
  getMaterials: (id: number) => api.get(`/cabinets/${id}/materials`),
  getInfosheet: (id: number) => api.get(`/cabinets/${id}/infosheet`),
  getCompartments: (id: number) => api.get(`/cabinets/${id}/compartments`),
  getCompartmentMaterials: (cabinetId: number, compartmentId: number) => api.get(`/cabinets/${cabinetId}/compartments/${compartmentId}/materials`),
  createCompartment: (cabinetId: number, data: any) => api.post(`/cabinets/${cabinetId}/compartments`, data),
  updateCompartment: (cabinetId: number, compartmentId: number, data: any) => api.put(`/cabinets/${cabinetId}/compartments/${compartmentId}`, data),
  deleteCompartment: (cabinetId: number, compartmentId: number) => api.delete(`/cabinets/${cabinetId}/compartments/${compartmentId}`),
  clear: (id: number) => api.post(`/cabinets/${id}/clear`),
  create: (data: any) => api.post('/cabinets', data),
  update: (id: number, data: any) => api.put(`/cabinets/${id}`, data),
  delete: (id: number) => api.delete(`/cabinets/${id}`),
};

// Materials
export const materialAPI = {
  getAll: (params?: any) => api.get('/materials', { params }),
  getById: (id: number) => api.get(`/materials/${id}`),
  getByGtin: (gtin: string) => api.get(`/materials/by-gtin/${encodeURIComponent(gtin)}`),
  getByName: (name: string) => api.get(`/materials/by-name/${encodeURIComponent(name)}`),
  getProductNames: (search: string) => api.get(`/materials/product-names?search=${encodeURIComponent(search)}`),
  getTransactions: (id: number) => api.get(`/materials/${id}/transactions`),
  search: (params: { lot_number?: string; expiry_months?: number; query?: string; category_id?: number; is_consignment?: boolean }) => api.post('/materials/search', params),
  create: (data: any) => api.post('/materials', data),
  update: (id: number, data: any) => api.put(`/materials/${id}`, data),
  delete: (id: number) => api.delete(`/materials/${id}`),
  reactivate: (id: number) => api.put(`/materials/${id}/reactivate`),
  stockIn: (id: number, data: any) => api.post(`/materials/${id}/stock-in`, data),
  stockOut: (id: number, data: any) => api.post(`/materials/${id}/stock-out`, data),
  getExpiring: () => api.get('/materials/reports/expiring'),
  getLowStock: () => api.get('/materials/reports/low-stock'),
  getInactive: (months: number = 6) => api.get(`/materials/reports/inactive?months=${months}`),
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
  searchGTIN: (gtin: string) => api.get(`/barcodes/gtin/${gtin}`),
  searchMaterialsByGTIN: (gtin: string, lot?: string) => 
    api.get(`/barcodes/gtin/${gtin}/materials${lot ? `?lot=${encodeURIComponent(lot)}` : ''}`),
  getByMaterial: (materialId: number) => api.get(`/barcodes/material/${materialId}`),
  create: (data: any) => api.post('/barcodes', data),
  update: (id: number, data: any) => api.put(`/barcodes/${id}`, data),
  delete: (id: number) => api.delete(`/barcodes/${id}`),
  scanOut: (data: any) => api.post('/barcodes/scan-out', data),
  removeMaterial: (materialId: number, data: any) => api.post(`/barcodes/material/${materialId}/remove`, data),
  addStock: (materialId: number, data: any) => api.post(`/barcodes/material/${materialId}/add`, data),
};

// Field Configurations
export const fieldConfigAPI = {
  getAll: () => api.get('/field-configs'),
  getById: (id: number) => api.get(`/field-configs/${id}`),
  create: (data: any) => api.post('/field-configs', data),
  update: (id: number, data: any) => api.put(`/field-configs/${id}`, data),
  delete: (id: number) => api.delete(`/field-configs/${id}`),
};

// Units (Departments)
export const unitAPI = {
  getAll: () => api.get('/units'),
  getById: (id: number) => api.get(`/units/${id}`),
  create: (data: any) => api.post('/units', data),
  update: (id: number, data: any) => api.put(`/units/${id}`, data),
  delete: (id: number) => api.delete(`/units/${id}`),
};

// Statistics
export const statisticsAPI = {
  getTransactions: (params?: any) => api.get('/statistics/transactions', { params }),
  getSummary: (params?: any) => api.get('/statistics/summary', { params }),
  getDaily: (params?: any) => api.get('/statistics/daily', { params }),
  getMonthly: (params?: any) => api.get('/statistics/monthly', { params }),
  getMaterialStats: (params?: any) => api.get('/statistics/material-stats', { params }),
  getUserActivity: (params?: any) => api.get('/statistics/user-activity', { params }),
};

// Shapes (Device-Formen)
export const shapeAPI = {
  getAll: () => api.get('/shapes'),
  getAllIncludingInactive: () => api.get('/shapes/all'),
  create: (data: any) => api.post('/shapes', data),
  update: (id: number, data: any) => api.put(`/shapes/${id}`, data),
  delete: (id: number) => api.delete(`/shapes/${id}`),
};

// Interventionsprotokolle
export const interventionAPI = {
  getAll: (params?: { search?: string; from_date?: string; to_date?: string; gtin?: string; lot_number?: string; limit?: number; offset?: number }) => 
    api.get('/interventions', { params }),
  getById: (id: number) => api.get(`/interventions/${id}`),
  create: (data: { 
    patient_id: string; 
    patient_name?: string; 
    started_at: string; 
    notes?: string; 
    items: Array<{
      materialName: string;
      articleNumber: string;
      lotNumber: string;
      expiryDate?: string;
      gtin?: string;
      quantity: number;
      timestamp: string;
      isConsignment?: boolean;
    }>;
  }) => api.post('/interventions', data),
  delete: (id: number) => api.delete(`/interventions/${id}`),
};

// Audit-Logs (nur für Admins)
export const auditLogAPI = {
  getAll: (params?: { 
    page?: number; 
    limit?: number; 
    action?: string; 
    entity_type?: string; 
    user_id?: number;
    start_date?: string;
    end_date?: string;
    search?: string;
  }) => api.get('/audit-logs', { params }),
  getStats: () => api.get('/audit-logs/stats'),
  getByEntity: (type: string, id: number) => api.get(`/audit-logs/entity/${type}/${id}`),
  getActions: () => api.get('/audit-logs/actions'),
  getEntityTypes: () => api.get('/audit-logs/entity-types'),
};
