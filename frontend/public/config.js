// Diese Datei wird zur Laufzeit geladen und enthält die API-Konfiguration
window.APP_CONFIG = {
  API_URL: window.location.hostname === 'localhost' 
    ? '/api'  // Lokal: Relative URL, Vite-Proxy nutzen
    : 'https://materialmanager-production.up.railway.app/api'  // Production: Vollständige Backend-URL
};
