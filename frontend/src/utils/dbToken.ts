// DB Token Management Utilities
// Token-Format: Base64-kodiertes JSON mit { host, user, password, database, port, ssl }

export interface DbCredentials {
  host: string;
  user: string;
  password: string;
  database: string;
  port: number;
  ssl?: boolean;
}

const DB_TOKEN_KEY = 'db_token';

/**
 * Dekodiert einen Base64 DB-Token zu Credentials
 */
export const decodeDbToken = (token: string): DbCredentials | null => {
  try {
    const decoded = atob(token);
    const parsed = JSON.parse(decoded);
    
    // Validierung
    if (!parsed.host || !parsed.user || !parsed.password || !parsed.database) {
      console.error('DB Token ungültig: Fehlende Felder');
      return null;
    }
    
    return {
      host: parsed.host,
      user: parsed.user,
      password: parsed.password,
      database: parsed.database,
      port: parsed.port || 3306,
      ssl: parsed.ssl !== false // Default: true
    };
  } catch (e) {
    console.error('DB Token Dekodierung fehlgeschlagen:', e);
    return null;
  }
};

/**
 * Kodiert Credentials zu einem Base64 DB-Token
 */
export const encodeDbToken = (credentials: DbCredentials): string => {
  const json = JSON.stringify({
    host: credentials.host,
    user: credentials.user,
    password: credentials.password,
    database: credentials.database,
    port: credentials.port || 3306,
    ssl: credentials.ssl !== false
  });
  return btoa(json);
};

/**
 * Speichert DB-Token im SessionStorage
 */
export const saveDbToken = (token: string): boolean => {
  const credentials = decodeDbToken(token);
  if (!credentials) {
    return false;
  }
  sessionStorage.setItem(DB_TOKEN_KEY, token);
  console.log('DB Token gespeichert für:', credentials.host);
  return true;
};

/**
 * Lädt DB-Token aus SessionStorage
 */
export const getDbToken = (): string | null => {
  return sessionStorage.getItem(DB_TOKEN_KEY);
};

/**
 * Entfernt DB-Token aus SessionStorage
 */
export const clearDbToken = (): void => {
  sessionStorage.removeItem(DB_TOKEN_KEY);
};

/**
 * Prüft ob ein gültiger DB-Token vorhanden ist
 */
export const hasValidDbToken = (): boolean => {
  const token = getDbToken();
  if (!token) return false;
  return decodeDbToken(token) !== null;
};

/**
 * Extrahiert DB-Token aus URL-Parametern und speichert ihn
 */
export const extractAndSaveDbTokenFromUrl = (): boolean => {
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('db_token');
  
  if (token) {
    const success = saveDbToken(token);
    if (success) {
      // Token aus URL entfernen (Security)
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('db_token');
      window.history.replaceState({}, document.title, newUrl.pathname + newUrl.search);
      console.log('DB Token aus URL extrahiert und gespeichert');
    }
    return success;
  }
  
  return false;
};

/**
 * Gibt die aktuellen DB-Credentials zurück (falls Token vorhanden)
 */
export const getCurrentDbCredentials = (): DbCredentials | null => {
  const token = getDbToken();
  if (!token) return null;
  return decodeDbToken(token);
};
