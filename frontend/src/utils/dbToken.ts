// DB Token Management Utilities
// Token-Format: Base64-kodiertes JSON mit { host, user, password, database, port, ssl }
// Speichert in localStorage UND IndexedDB für PWA-Kompatibilität

export interface DbCredentials {
  host: string;
  user: string;
  password: string;
  database: string;
  port: number;
  ssl?: boolean;
}

const DB_TOKEN_KEY = 'db_token';
const IDB_NAME = 'MaterialManagerConfig';
const IDB_STORE = 'config';

// IndexedDB Helper für PWA-Persistenz
const openConfigDb = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_NAME, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
  });
};

const saveToIndexedDB = async (key: string, value: string): Promise<void> => {
  try {
    const db = await openConfigDb();
    const tx = db.transaction(IDB_STORE, 'readwrite');
    const store = tx.objectStore(IDB_STORE);
    store.put(value, key);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (e) {
    console.warn('[dbToken] IndexedDB save failed:', e);
  }
};

const loadFromIndexedDB = async (key: string): Promise<string | null> => {
  try {
    const db = await openConfigDb();
    const tx = db.transaction(IDB_STORE, 'readonly');
    const store = tx.objectStore(IDB_STORE);
    const request = store.get(key);
    const result = await new Promise<string | null>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return result;
  } catch (e) {
    console.warn('[dbToken] IndexedDB load failed:', e);
    return null;
  }
};

const deleteFromIndexedDB = async (key: string): Promise<void> => {
  try {
    const db = await openConfigDb();
    const tx = db.transaction(IDB_STORE, 'readwrite');
    const store = tx.objectStore(IDB_STORE);
    store.delete(key);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (e) {
    console.warn('[dbToken] IndexedDB delete failed:', e);
  }
};

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
 * Speichert DB-Token in localStorage UND IndexedDB (für PWA-Persistenz)
 */
export const saveDbToken = (token: string): boolean => {
  const credentials = decodeDbToken(token);
  if (!credentials) {
    return false;
  }
  // Speichere in localStorage (synchron, schnell)
  localStorage.setItem(DB_TOKEN_KEY, token);
  // Speichere auch in IndexedDB (für PWA-Kompatibilität)
  saveToIndexedDB(DB_TOKEN_KEY, token);
  console.log('[dbToken] Token gespeichert für:', credentials.host);
  return true;
};

/**
 * Lädt DB-Token aus localStorage (sync) - für normale Requests
 */
export const getDbToken = (): string | null => {
  return localStorage.getItem(DB_TOKEN_KEY);
};

/**
 * Lädt DB-Token aus IndexedDB und synchronisiert mit localStorage
 * Sollte beim App-Start aufgerufen werden
 */
export const syncDbTokenFromIndexedDB = async (): Promise<string | null> => {
  const localToken = localStorage.getItem(DB_TOKEN_KEY);
  const idbToken = await loadFromIndexedDB(DB_TOKEN_KEY);
  
  console.log('[dbToken] Sync check - localStorage:', !!localToken, 'IndexedDB:', !!idbToken);
  
  // Wenn IndexedDB Token hat, aber localStorage nicht -> übertragen
  if (idbToken && !localToken) {
    localStorage.setItem(DB_TOKEN_KEY, idbToken);
    console.log('[dbToken] Token aus IndexedDB in localStorage übertragen');
    return idbToken;
  }
  
  // Wenn localStorage Token hat, aber IndexedDB nicht -> IndexedDB aktualisieren
  if (localToken && !idbToken) {
    await saveToIndexedDB(DB_TOKEN_KEY, localToken);
    console.log('[dbToken] Token aus localStorage in IndexedDB übertragen');
  }
  
  return localToken || idbToken;
};

/**
 * Entfernt DB-Token aus localStorage UND IndexedDB
 */
export const clearDbToken = (): void => {
  localStorage.removeItem(DB_TOKEN_KEY);
  deleteFromIndexedDB(DB_TOKEN_KEY);
  console.log('[dbToken] Token gelöscht');
};
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
