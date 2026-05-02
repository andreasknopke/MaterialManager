import axios from 'axios';
import { getDbToken } from '../utils/dbToken';
import offlineStorage from './offlineStorage';
import { dispatchForcedLogout } from '../utils/sessionEvents';

// Use relative URL for API calls - nginx will proxy to backend
const API_BASE_URL = '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

function createIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `req-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function getCachePrefixesToInvalidate(url?: string): string[] {
  if (!url) return [];

  const cacheablePrefixes = ['/materials', '/cabinets', '/categories', '/companies', '/units'];
  return cacheablePrefixes.filter(prefix => url.includes(prefix));
}

function getErrorMessage(error: any): string {
  return error?.response?.data?.error || error?.response?.data?.message || error?.message || 'Unbekannter Fehler';
}

function isAuthenticationError(error: any): boolean {
  return error?.response?.status === 401;
}

function isFatalDatabaseConnectionError(error: any): boolean {
  if (error?.response?.status !== 500) {
    return false;
  }

  const errorCode = String(error?.response?.data?.code || '').toLowerCase();
  const errorMessage = getErrorMessage(error).toLowerCase();

  return (
    /db[-_ ]?connection|database[-_ ]?connection|connection[-_ ]?lost|connection[-_ ]?refused|too many connections|cannot enqueue|pool is closed/i.test(errorCode) ||
    /datenbankverbindung|database connection|connection lost|connection refused|too many connections|pool is closed|server has gone away/i.test(errorMessage)
  );
}

function handleFatalOfflineFailure(message: string): never {
  dispatchForcedLogout({
    title: 'Sitzung beendet',
    message,
    code: 'offline-cache-failure',
  });

  throw new Error(message);
}

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

    if (['post', 'put', 'delete'].includes(config.method || '') && !config.headers['X-Idempotency-Key']) {
      config.headers['X-Idempotency-Key'] = createIdempotencyKey();
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response Interceptor mit Offline-Unterstützung
api.interceptors.response.use(
  async (response) => {
    // Erfolgreiche GET-Requests cachen
    if (response.config.method === 'get' && response.status === 200) {
      const cacheKey = response.config.url || '';
      if (cacheKey && shouldCache(cacheKey)) {
        await offlineStorage.cacheData(cacheKey, response.data);
      }
    }

    if (['post', 'put', 'delete'].includes(response.config.method || '')) {
      const prefixes = getCachePrefixesToInvalidate(response.config.url);
      if (prefixes.length > 0) {
        await offlineStorage.invalidateCachedData(prefixes);
      }
    }

    return response;
  },
  async (error) => {
    if (isAuthenticationError(error)) {
      dispatchForcedLogout({
        title: 'Anmeldung abgelaufen',
        message: 'Ihre Anmeldung oder Datenbank-Sitzung ist nicht mehr gültig. Bitte melden Sie sich erneut an.',
        code: 'auth',
      });
      return Promise.reject(error);
    }

    // Bei Netzwerk-Fehler: Versuche aus Cache zu laden (GET) oder Queue (POST/PUT/DELETE)
    if (!error.response) {
      const config = error.config;
      if (!config) {
        return Promise.reject(error);
      }
      
      if (config.method === 'get') {
        // Versuche gecachte Daten zurückzugeben
        const cacheKey = config.url;
        let cachedData = null;

        try {
          cachedData = await offlineStorage.getCachedData(cacheKey);
        } catch (cacheError) {
          console.error('[API] Cache read failed:', cacheError);
          handleFatalOfflineFailure('Die Verbindung ist unterbrochen und der Offline-Zwischenspeicher ist nicht verfügbar. Sie wurden zur Sicherheit abgemeldet.');
        }
        
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
        try {
          await offlineStorage.addPendingChange({
            url: `${API_BASE_URL}${config.url}`,
            method: config.method?.toUpperCase() || 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': config.headers.Authorization || '',
              'X-DB-Token': config.headers['X-DB-Token'] || '',
              'X-Idempotency-Key': config.headers['X-Idempotency-Key'] || createIdempotencyKey()
            },
            body: config.data || ''
          });
        } catch (queueError) {
          console.error('[API] Offline queue failed:', queueError);
          handleFatalOfflineFailure('Die Serververbindung ist unterbrochen und die Offline-Speicherung ist fehlgeschlagen. Sie wurden zur Sicherheit abgemeldet, damit keine Scans verloren gehen.');
        }
        
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
    
    const errorMessage = getErrorMessage(error);
    console.error('API Error:', error.response?.data || error.message);

    if (isFatalDatabaseConnectionError(error)) {
      dispatchForcedLogout({
        title: 'Datenbankverbindung verloren',
        message: 'Die Datenbankverbindung ist fehlgeschlagen. Bitte melden Sie sich erneut an, bevor Sie weitere Scans durchführen.',
        code: 'db-connection',
      });
    }

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
  convertPackageToItems: (id: number, data: any) => api.post(`/materials/${id}/convert-package-to-items`, data),
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
  update: (id: number, data: { patient_id: string; patient_name?: string; notes?: string }) => 
    api.put(`/interventions/${id}`, data),
  
  // Nachträgliche Patientenzuordnung
  getUnassignedTransactions: (params?: { 
    search?: string; 
    from_date?: string; 
    to_date?: string; 
    gtin?: string; 
    lot_number?: string; 
    category_id?: number;
    limit?: number; 
    offset?: number 
  }) => api.get('/interventions/unassigned/transactions', { params }),
  
  addItemsToProtocol: (protocolId: number, transaction_ids: number[]) => 
    api.post(`/interventions/${protocolId}/add-items`, { transaction_ids }),
  
  createFromTransactions: (data: { 
    patient_id: string; 
    patient_name?: string; 
    notes?: string; 
    transaction_ids: number[] 
  }) => api.post('/interventions/create-from-transactions', data),
  
  removeItem: (protocolId: number, itemId: number) => 
    api.delete(`/interventions/${protocolId}/items/${itemId}`),
  
  updateTransactionLot: (transactionId: number, lot_number: string) =>
    api.put(`/interventions/transactions/${transactionId}/lot`, { lot_number }),
  
  // Admin-Funktion: Protokoll-Details bearbeiten
  updateProtocol: (id: number, data: { patient_id?: string; patient_name?: string; notes?: string; started_at?: string }) => 
    api.put(`/interventions/${id}`, data),
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

// AI / Mistral Integration
export const aiAPI = {
  getStatus: () => api.get('/ai/status'),
  suggestProducts: (query: string, includeContext: boolean = false) => 
    api.post('/ai/suggest-products', { query, includeContext }),
  analyzeBarcode: (barcode: string, scannedText?: string) => 
    api.post('/ai/analyze-barcode', { barcode, scannedText }),
  autocomplete: (input: string) => 
    api.post('/ai/autocomplete', { input }),
  lookupMaterial: (materialId: number) => 
    api.post('/ai/lookup-material', { materialId }),
  analyzeInventoryPhoto: (cabinetId: number, imageBase64: string, compartmentId?: number) =>
    api.post('/ai/analyze-inventory-photo', { cabinetId, imageBase64, compartmentId }),
};
