import { useState, useEffect, useCallback } from 'react';
import { offlineStorage } from '../services/offlineStorage';

export function useOffline() {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    // Initial check
    offlineStorage.checkConnection().then(setIsOnline);
    loadPendingCount();

    // Listen for network changes
    const unsubscribe = offlineStorage.addListener((online) => {
      setIsOnline(online);
      if (online) {
        loadPendingCount();
      }
    });

    return unsubscribe;
  }, []);

  const loadPendingCount = async () => {
    const pending = await offlineStorage.getPendingActions();
    setPendingCount(pending.length);
  };

  const addPendingAction = useCallback(async (action) => {
    await offlineStorage.addPendingAction(action);
    await loadPendingCount();
  }, []);

  const syncNow = useCallback(async () => {
    if (isOnline) {
      await offlineStorage.syncPendingActions();
      await loadPendingCount();
    }
  }, [isOnline]);

  return {
    isOnline,
    pendingCount,
    addPendingAction,
    syncNow,
  };
}

export function useOfflineData(fetchFn, cacheKey, cacheFn, getCacheFn) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isFromCache, setIsFromCache] = useState(false);
  const { isOnline } = useOffline();

  const loadData = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    setError(null);

    try {
      if (isOnline && !forceRefresh) {
        // Try to fetch fresh data
        const freshData = await fetchFn();
        setData(freshData);
        setIsFromCache(false);
        
        // Cache the data
        if (cacheFn) {
          await cacheFn(freshData);
        }
      } else {
        // Offline or force cache - try to get cached data
        if (getCacheFn) {
          const cachedData = await getCacheFn();
          if (cachedData) {
            setData(cachedData);
            setIsFromCache(true);
          } else if (!isOnline) {
            setError('No cached data available');
          }
        }
        
        // If online but forced cache, still try to fetch
        if (isOnline) {
          const freshData = await fetchFn();
          setData(freshData);
          setIsFromCache(false);
          if (cacheFn) {
            await cacheFn(freshData);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load data:', err);
      
      // Try cache as fallback
      if (getCacheFn) {
        const cachedData = await getCacheFn();
        if (cachedData) {
          setData(cachedData);
          setIsFromCache(true);
        } else {
          setError(err.message || 'Failed to load data');
        }
      } else {
        setError(err.message || 'Failed to load data');
      }
    } finally {
      setLoading(false);
    }
  }, [isOnline, fetchFn, cacheFn, getCacheFn]);

  useEffect(() => {
    loadData();
  }, []);

  return {
    data,
    loading,
    error,
    isFromCache,
    refresh: () => loadData(false),
    forceRefresh: () => loadData(true),
  };
}

export default useOffline;
