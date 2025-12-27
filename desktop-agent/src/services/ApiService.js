const axios = require('axios');

class ApiService {
    constructor(baseUrl) {
        this.baseUrl = baseUrl;
        this.token = null;
        this.isOnline = true;
        this.pendingSync = []; // Queue for offline operations
        
        this.client = axios.create({
            baseURL: baseUrl,
            timeout: 30000,
            headers: {
                'Content-Type': 'application/json',
            },
        });

        this.client.interceptors.request.use((config) => {
            if (this.token) {
                config.headers.Authorization = `Bearer ${this.token}`;
            }
            return config;
        });

        this.client.interceptors.response.use(
            (response) => {
                this.isOnline = true;
                return response.data;
            },
            (error) => {
                if (!error.response) {
                    this.isOnline = false;
                }
                
                // Handle token expiry (401 Unauthorized)
                if (error.response?.status === 401) {
                    this.token = null;
                    this.onTokenExpired?.();
                }
                
                console.error('API Error:', error.response?.data || error.message);
                throw error.response?.data || error;
            }
        );
    }

    // Set callback for token expiry
    setTokenExpiredCallback(callback) {
        this.onTokenExpired = callback;
    }

    // Retry wrapper for critical operations
    async withRetry(operation, maxRetries = 3, baseDelay = 1000) {
        let lastError;
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error;
                if (attempt < maxRetries - 1) {
                    const delay = baseDelay * Math.pow(2, attempt);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }
        throw lastError;
    }

    // Queue operation for later sync when offline
    queueForSync(type, data) {
        this.pendingSync.push({ type, data, timestamp: Date.now() });
    }

    getPendingSync() {
        return this.pendingSync;
    }

    clearSyncQueue() {
        this.pendingSync = [];
    }

    setToken(token) {
        this.token = token;
    }

    async login(credentials) {
        return this.client.post('/auth/login', credentials);
    }

    async getGroups() {
        return this.client.get('/groups/list');
    }

    async registerAgent(data) {
        return this.client.post('/agent/register', data);
    }

    async heartbeat(data) {
        return this.client.post('/agent/heartbeat', data);
    }

    async getConfig(agentId) {
        return this.client.get('/agent/config', { params: { agent_id: agentId } });
    }

    async bindSdCard(data) {
        return this.client.post('/agent/sd-card/bind', data);
    }

    async getSdCard(hardwareId) {
        return this.client.get('/agent/sd-card', { params: { hardware_id: hardwareId } });
    }

    async startSession(data) {
        return this.client.post('/session/start', data);
    }

    async updateSessionProgress(sessionId, data) {
        return this.client.put(`/session/${sessionId}/progress`, data);
    }

    async endSession(sessionId, data) {
        return this.client.post(`/session/${sessionId}/end`, data);
    }

    async syncMedia(data) {
        try {
            return await this.client.post('/media/sync', data);
        } catch (error) {
            // Queue for later if offline
            if (!this.isOnline) {
                this.queueForSync('media', data);
            }
            throw error;
        }
    }

    async batchSyncMedia(data) {
        return this.client.post('/media/batch-sync', data);
    }

    async processSyncQueue() {
        if (this.pendingSync.length === 0) return { processed: 0, failed: 0 };
        
        let processed = 0;
        let failed = 0;
        const remaining = [];

        for (const item of this.pendingSync) {
            try {
                if (item.type === 'media') {
                    await this.client.post('/media/sync', item.data);
                } else if (item.type === 'issue') {
                    await this.client.post('/issues/report', item.data);
                }
                processed++;
            } catch (error) {
                failed++;
                remaining.push(item);
            }
        }

        this.pendingSync = remaining;
        return { processed, failed, remaining: remaining.length };
    }

    async reportIssue(data) {
        return this.client.post('/issues/report', data);
    }

    async createBackup(data) {
        return this.client.post('/backup/create', data);
    }

    async verifyBackup(data) {
        return this.client.post('/backup/verify', data);
    }

    async getActiveEvents() {
        return this.client.get('/events/active');
    }

    async getEvent(eventId) {
        const response = await this.client.get(`/events/${eventId}`);
        return response.event || response;
    }

    async validateGroup(groupCode) {
        return this.client.post('/groups/validate', { group_code: groupCode });
    }

    async getEditorDashboard() {
        return this.client.get('/dashboard/editor');
    }

    async userHeartbeat(data) {
        return this.client.post('/users/heartbeat', data);
    }

    async setUserOffline() {
        return this.client.post('/users/offline');
    }

    // Media Deletion / Data Protection
    async getPendingDeletionTasks(deviceId) {
        return this.client.get('/media-deletion/tasks', { params: { device_id: deviceId } });
    }

    async reportDeletionTaskCompletion(taskId, deviceId, status, errorMessage = null) {
        return this.client.post('/media-deletion/tasks/complete', {
            task_id: taskId,
            device_id: deviceId,
            status: status,
            error_message: errorMessage,
        });
    }

    async ping() {
        const start = Date.now();
        try {
            const response = await this.client.get('/health', { timeout: 10000 });
            console.log('Ping response:', response);
            return { online: true, latency: Date.now() - start };
        } catch (e) {
            console.error('Ping failed:', e.message);
            // Try a simple HEAD request as fallback
            try {
                await axios.get(this.baseUrl + '/health', { timeout: 10000 });
                return { online: true, latency: Date.now() - start };
            } catch (e2) {
                console.error('Fallback ping failed:', e2.message);
                return { online: false, latency: null };
            }
        }
    }
}

module.exports = { ApiService };
