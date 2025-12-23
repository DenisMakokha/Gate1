import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

const CACHE_KEYS = {
  DASHBOARD: '@cache_dashboard',
  ISSUES: '@cache_issues',
  EVENTS: '@cache_events',
  MY_SHIFTS: '@cache_my_shifts',
  ACTIVITY_FEED: '@cache_activity_feed',
  PENDING_ACTIONS: '@pending_actions',
  LAST_SYNC: '@last_sync',
};

const CACHE_EXPIRY = {
  DASHBOARD: 5 * 60 * 1000, // 5 minutes
  ISSUES: 10 * 60 * 1000, // 10 minutes
  EVENTS: 30 * 60 * 1000, // 30 minutes
  MY_SHIFTS: 15 * 60 * 1000, // 15 minutes
  ACTIVITY_FEED: 5 * 60 * 1000, // 5 minutes
};

class OfflineStorage {
  constructor() {
    this.isOnline = true;
    this.listeners = [];
    this.initNetworkListener();
  }

  initNetworkListener() {
    NetInfo.addEventListener((state) => {
      const wasOnline = this.isOnline;
      this.isOnline = state.isConnected && state.isInternetReachable;
      
      if (!wasOnline && this.isOnline) {
        // Back online - sync pending actions
        this.syncPendingActions();
      }
      
      this.notifyListeners();
    });
  }

  addListener(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== callback);
    };
  }

  notifyListeners() {
    this.listeners.forEach((callback) => callback(this.isOnline));
  }

  async checkConnection() {
    const state = await NetInfo.fetch();
    this.isOnline = state.isConnected && state.isInternetReachable;
    return this.isOnline;
  }

  // Cache data with timestamp
  async cacheData(key, data) {
    try {
      const cacheEntry = {
        data,
        timestamp: Date.now(),
      };
      await AsyncStorage.setItem(key, JSON.stringify(cacheEntry));
    } catch (error) {
      console.error('Failed to cache data:', error);
    }
  }

  // Get cached data if not expired
  async getCachedData(key, maxAge) {
    try {
      const cached = await AsyncStorage.getItem(key);
      if (!cached) return null;

      const { data, timestamp } = JSON.parse(cached);
      const age = Date.now() - timestamp;

      if (maxAge && age > maxAge) {
        return null; // Cache expired
      }

      return data;
    } catch (error) {
      console.error('Failed to get cached data:', error);
      return null;
    }
  }

  // Dashboard data
  async cacheDashboard(data) {
    await this.cacheData(CACHE_KEYS.DASHBOARD, data);
  }

  async getCachedDashboard() {
    return this.getCachedData(CACHE_KEYS.DASHBOARD, CACHE_EXPIRY.DASHBOARD);
  }

  // Issues data
  async cacheIssues(data) {
    await this.cacheData(CACHE_KEYS.ISSUES, data);
  }

  async getCachedIssues() {
    return this.getCachedData(CACHE_KEYS.ISSUES, CACHE_EXPIRY.ISSUES);
  }

  // Events data
  async cacheEvents(data) {
    await this.cacheData(CACHE_KEYS.EVENTS, data);
  }

  async getCachedEvents() {
    return this.getCachedData(CACHE_KEYS.EVENTS, CACHE_EXPIRY.EVENTS);
  }

  // Shifts data
  async cacheMyShifts(data) {
    await this.cacheData(CACHE_KEYS.MY_SHIFTS, data);
  }

  async getCachedMyShifts() {
    return this.getCachedData(CACHE_KEYS.MY_SHIFTS, CACHE_EXPIRY.MY_SHIFTS);
  }

  // Activity feed
  async cacheActivityFeed(data) {
    await this.cacheData(CACHE_KEYS.ACTIVITY_FEED, data);
  }

  async getCachedActivityFeed() {
    return this.getCachedData(CACHE_KEYS.ACTIVITY_FEED, CACHE_EXPIRY.ACTIVITY_FEED);
  }

  // Pending actions for offline mode
  async addPendingAction(action) {
    try {
      const pending = await this.getPendingActions();
      pending.push({
        ...action,
        id: Date.now().toString(),
        createdAt: new Date().toISOString(),
      });
      await AsyncStorage.setItem(CACHE_KEYS.PENDING_ACTIONS, JSON.stringify(pending));
    } catch (error) {
      console.error('Failed to add pending action:', error);
    }
  }

  async getPendingActions() {
    try {
      const pending = await AsyncStorage.getItem(CACHE_KEYS.PENDING_ACTIONS);
      return pending ? JSON.parse(pending) : [];
    } catch (error) {
      console.error('Failed to get pending actions:', error);
      return [];
    }
  }

  async removePendingAction(actionId) {
    try {
      const pending = await this.getPendingActions();
      const filtered = pending.filter((a) => a.id !== actionId);
      await AsyncStorage.setItem(CACHE_KEYS.PENDING_ACTIONS, JSON.stringify(filtered));
    } catch (error) {
      console.error('Failed to remove pending action:', error);
    }
  }

  async syncPendingActions() {
    const pending = await this.getPendingActions();
    if (pending.length === 0) return;

    console.log(`Syncing ${pending.length} pending actions...`);

    for (const action of pending) {
      try {
        await this.executePendingAction(action);
        await this.removePendingAction(action.id);
        console.log(`Synced action: ${action.type}`);
      } catch (error) {
        console.error(`Failed to sync action ${action.type}:`, error);
        // Keep the action for retry
      }
    }

    await this.updateLastSync();
  }

  async executePendingAction(action) {
    // Import api dynamically to avoid circular dependency
    const api = require('./api').default;

    switch (action.type) {
      case 'CREATE_ISSUE':
        await api.post('/issues', action.payload);
        break;
      case 'UPDATE_ISSUE':
        await api.put(`/issues/${action.payload.id}`, action.payload.data);
        break;
      case 'CHECK_IN':
        await api.post(`/shifts/${action.payload.shiftId}/check-in`);
        break;
      case 'CHECK_OUT':
        await api.post(`/shifts/${action.payload.shiftId}/check-out`);
        break;
      default:
        console.warn(`Unknown action type: ${action.type}`);
    }
  }

  async updateLastSync() {
    await AsyncStorage.setItem(CACHE_KEYS.LAST_SYNC, new Date().toISOString());
  }

  async getLastSync() {
    return AsyncStorage.getItem(CACHE_KEYS.LAST_SYNC);
  }

  // Clear all cached data
  async clearCache() {
    try {
      const keys = Object.values(CACHE_KEYS);
      await AsyncStorage.multiRemove(keys);
    } catch (error) {
      console.error('Failed to clear cache:', error);
    }
  }

  // Get cache status
  async getCacheStatus() {
    const status = {};
    for (const [name, key] of Object.entries(CACHE_KEYS)) {
      try {
        const cached = await AsyncStorage.getItem(key);
        if (cached) {
          const { timestamp } = JSON.parse(cached);
          status[name] = {
            cached: true,
            age: Date.now() - timestamp,
            ageFormatted: this.formatAge(Date.now() - timestamp),
          };
        } else {
          status[name] = { cached: false };
        }
      } catch {
        status[name] = { cached: false };
      }
    }
    return status;
  }

  formatAge(ms) {
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  }
}

export const offlineStorage = new OfflineStorage();
export default offlineStorage;
