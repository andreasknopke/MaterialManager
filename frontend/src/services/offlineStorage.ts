/**
 * Offline Storage Service
 * Verwendet IndexedDB für persistente Speicherung von Offline-Änderungen
 */

const DB_NAME = 'MaterialManagerOffline';
const DB_VERSION = 1;

// Store Names
const STORES = {
  PENDING_CHANGES: 'pendingChanges',
  CACHED_DATA: 'cachedData',
  SYNC_LOG: 'syncLog'
};

class OfflineStorageService {
  private db: IDBDatabase | null = null;
  private isOnline: boolean = navigator.onLine;
  private syncInProgress: boolean = false;
  private listeners: Set<(isOnline: boolean) => void> = new Set();

  constructor() {
    this.init();
    this.setupEventListeners();
  }

  private async init(): Promise<void> {
    try {
      this.db = await this.openDatabase();
      console.log('[OfflineStorage] Database initialized');
      
      // Bei Online-Status sofort synchronisieren
      if (this.isOnline) {
        this.syncPendingChanges();
      }
    } catch (error) {
      console.error('[OfflineStorage] Failed to initialize:', error);
    }
  }

  private openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Pending Changes Store
        if (!db.objectStoreNames.contains(STORES.PENDING_CHANGES)) {
          const pendingStore = db.createObjectStore(STORES.PENDING_CHANGES, { 
            keyPath: 'id', 
            autoIncrement: true 
          });
          pendingStore.createIndex('timestamp', 'timestamp', { unique: false });
          pendingStore.createIndex('type', 'type', { unique: false });
        }

        // Cached Data Store (für Offline-Lesezugriff)
        if (!db.objectStoreNames.contains(STORES.CACHED_DATA)) {
          const cachedStore = db.createObjectStore(STORES.CACHED_DATA, { 
            keyPath: 'key' 
          });
          cachedStore.createIndex('lastUpdated', 'lastUpdated', { unique: false });
        }

        // Sync Log Store
        if (!db.objectStoreNames.contains(STORES.SYNC_LOG)) {
          const syncStore = db.createObjectStore(STORES.SYNC_LOG, { 
            keyPath: 'id', 
            autoIncrement: true 
          });
          syncStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  private setupEventListeners(): void {
    window.addEventListener('online', () => {
      console.log('[OfflineStorage] Online');
      this.isOnline = true;
      this.notifyListeners(true);
      this.syncPendingChanges();
    });

    window.addEventListener('offline', () => {
      console.log('[OfflineStorage] Offline');
      this.isOnline = false;
      this.notifyListeners(false);
    });

    // Service Worker Messages
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data.type === 'OFFLINE_REQUEST') {
          this.addPendingChange(event.data.payload);
        } else if (event.data.type === 'TRIGGER_SYNC') {
          this.syncPendingChanges();
        }
      });
    }
  }

  // Online-Status-Listener hinzufügen
  public onStatusChange(callback: (isOnline: boolean) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notifyListeners(isOnline: boolean): void {
    this.listeners.forEach(listener => listener(isOnline));
  }

  public getOnlineStatus(): boolean {
    return this.isOnline;
  }

  // Pending Change hinzufügen
  public async addPendingChange(change: {
    url: string;
    method: string;
    headers: Record<string, string>;
    body: string;
    timestamp?: number;
    type?: string;
  }): Promise<number> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.PENDING_CHANGES], 'readwrite');
      const store = transaction.objectStore(STORES.PENDING_CHANGES);

      const record = {
        ...change,
        timestamp: change.timestamp || Date.now(),
        type: change.type || this.getChangeType(change.url, change.method),
        retryCount: 0
      };

      const request = store.add(record);
      request.onsuccess = () => {
        console.log('[OfflineStorage] Change queued:', record.type);
        this.updatePendingCountInLocalStorage();
        resolve(request.result as number);
      };
      request.onerror = () => reject(request.error);
    });
  }

  private getChangeType(url: string, method: string): string {
    const urlParts = url.split('/');
    const resource = urlParts.find(p => ['materials', 'cabinets', 'categories', 'companies'].includes(p)) || 'unknown';
    return `${method.toLowerCase()}_${resource}`;
  }

  // Alle ausstehenden Änderungen abrufen
  public async getPendingChanges(): Promise<any[]> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.PENDING_CHANGES], 'readonly');
      const store = transaction.objectStore(STORES.PENDING_CHANGES);
      const index = store.index('timestamp');
      const request = index.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Anzahl ausstehender Änderungen
  public async getPendingCount(): Promise<number> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.PENDING_CHANGES], 'readonly');
      const store = transaction.objectStore(STORES.PENDING_CHANGES);
      const request = store.count();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Pending Change löschen
  public async removePendingChange(id: number): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.PENDING_CHANGES], 'readwrite');
      const store = transaction.objectStore(STORES.PENDING_CHANGES);
      const request = store.delete(id);

      request.onsuccess = () => {
        this.updatePendingCountInLocalStorage();
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Daten cachen
  public async cacheData(key: string, data: any): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.CACHED_DATA], 'readwrite');
      const store = transaction.objectStore(STORES.CACHED_DATA);

      const record = {
        key,
        data,
        lastUpdated: Date.now()
      };

      const request = store.put(record);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Gecachte Daten abrufen
  public async getCachedData<T>(key: string): Promise<T | null> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.CACHED_DATA], 'readonly');
      const store = transaction.objectStore(STORES.CACHED_DATA);
      const request = store.get(key);

      request.onsuccess = () => {
        const result = request.result;
        resolve(result ? result.data : null);
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Ausstehende Änderungen synchronisieren
  public async syncPendingChanges(): Promise<{ success: number; failed: number }> {
    if (!this.isOnline || this.syncInProgress) {
      return { success: 0, failed: 0 };
    }

    this.syncInProgress = true;
    let success = 0;
    let failed = 0;

    try {
      const pendingChanges = await this.getPendingChanges();
      console.log(`[OfflineStorage] Syncing ${pendingChanges.length} pending changes`);

      for (const change of pendingChanges) {
        try {
          const response = await fetch(change.url, {
            method: change.method,
            headers: change.headers,
            body: change.body
          });

          if (response.ok || response.status === 201) {
            await this.removePendingChange(change.id);
            await this.logSync(change, 'success');
            success++;
          } else if (response.status >= 400 && response.status < 500) {
            // Client-Error: Nicht erneut versuchen
            await this.removePendingChange(change.id);
            await this.logSync(change, 'client_error', await response.text());
            failed++;
          } else {
            // Server-Error: Für später aufheben
            await this.logSync(change, 'server_error');
            failed++;
          }
        } catch (error) {
          console.error('[OfflineStorage] Sync failed for:', change.type, error);
          await this.logSync(change, 'network_error');
          failed++;
        }
      }

      // Letzten Sync-Zeitpunkt speichern
      localStorage.setItem('lastSyncTime', Date.now().toString());
      this.updatePendingCountInLocalStorage();

    } finally {
      this.syncInProgress = false;
    }

    console.log(`[OfflineStorage] Sync complete: ${success} success, ${failed} failed`);
    return { success, failed };
  }

  private async logSync(change: any, status: string, error?: string): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve) => {
      const transaction = this.db!.transaction([STORES.SYNC_LOG], 'readwrite');
      const store = transaction.objectStore(STORES.SYNC_LOG);

      store.add({
        changeType: change.type,
        url: change.url,
        status,
        error,
        timestamp: Date.now()
      });

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => resolve();
    });
  }

  private async updatePendingCountInLocalStorage(): Promise<void> {
    try {
      const count = await this.getPendingCount();
      const changes = await this.getPendingChanges();
      localStorage.setItem('pendingChanges', JSON.stringify(changes));
      
      // Event für UI-Updates dispatchen
      window.dispatchEvent(new CustomEvent('pendingChangesUpdated', { 
        detail: { count, changes } 
      }));
    } catch (error) {
      console.error('[OfflineStorage] Failed to update pending count:', error);
    }
  }

  // Service Worker registrieren
  public async registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
    if (!('serviceWorker' in navigator)) {
      console.log('[OfflineStorage] Service Workers not supported');
      return null;
    }

    try {
      const registration = await navigator.serviceWorker.register('/service-worker.js', {
        scope: '/'
      });
      
      console.log('[OfflineStorage] Service Worker registered:', registration.scope);

      // Background Sync registrieren
      if ('sync' in registration) {
        await (registration as any).sync.register('sync-pending-changes');
      }

      return registration;
    } catch (error) {
      console.error('[OfflineStorage] Service Worker registration failed:', error);
      return null;
    }
  }
}

// Singleton-Instanz
export const offlineStorage = new OfflineStorageService();

export default offlineStorage;
