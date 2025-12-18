/**
 * useOffline Hook
 * React-Hook für Offline-Funktionalität
 */

import { useState, useEffect, useCallback } from 'react';
import offlineStorage from '../services/offlineStorage';

interface OfflineState {
  isOnline: boolean;
  pendingCount: number;
  isSyncing: boolean;
  lastSyncTime: Date | null;
}

interface UseOfflineReturn extends OfflineState {
  syncNow: () => Promise<{ success: number; failed: number }>;
  addPendingChange: (change: any) => Promise<number>;
  getPendingChanges: () => Promise<any[]>;
}

export function useOffline(): UseOfflineReturn {
  const [state, setState] = useState<OfflineState>({
    isOnline: navigator.onLine,
    pendingCount: 0,
    isSyncing: false,
    lastSyncTime: null
  });

  useEffect(() => {
    // Online-Status Listener
    const unsubscribe = offlineStorage.onStatusChange((isOnline) => {
      setState(prev => ({ ...prev, isOnline }));
    });

    // Pending Count laden
    const loadPendingCount = async () => {
      const count = await offlineStorage.getPendingCount();
      const lastSync = localStorage.getItem('lastSyncTime');
      setState(prev => ({ 
        ...prev, 
        pendingCount: count,
        lastSyncTime: lastSync ? new Date(parseInt(lastSync)) : null
      }));
    };
    loadPendingCount();

    // Event Listener für Pending Changes Updates
    const handlePendingUpdate = (event: CustomEvent) => {
      setState(prev => ({ 
        ...prev, 
        pendingCount: event.detail.count 
      }));
    };
    window.addEventListener('pendingChangesUpdated', handlePendingUpdate as EventListener);

    // Service Worker registrieren
    offlineStorage.registerServiceWorker();

    return () => {
      unsubscribe();
      window.removeEventListener('pendingChangesUpdated', handlePendingUpdate as EventListener);
    };
  }, []);

  const syncNow = useCallback(async () => {
    setState(prev => ({ ...prev, isSyncing: true }));
    try {
      const result = await offlineStorage.syncPendingChanges();
      const count = await offlineStorage.getPendingCount();
      setState(prev => ({ 
        ...prev, 
        pendingCount: count,
        lastSyncTime: new Date(),
        isSyncing: false
      }));
      return result;
    } catch (error) {
      setState(prev => ({ ...prev, isSyncing: false }));
      throw error;
    }
  }, []);

  const addPendingChange = useCallback(async (change: any) => {
    const id = await offlineStorage.addPendingChange(change);
    const count = await offlineStorage.getPendingCount();
    setState(prev => ({ ...prev, pendingCount: count }));
    return id;
  }, []);

  const getPendingChanges = useCallback(async () => {
    return offlineStorage.getPendingChanges();
  }, []);

  return {
    ...state,
    syncNow,
    addPendingChange,
    getPendingChanges
  };
}

export default useOffline;
