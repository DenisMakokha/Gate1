const axios = require('axios');

class ApiService {
    constructor(baseUrl) {
        this.baseUrl = baseUrl;
        this.token = null;
        
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
            (response) => response.data,
            (error) => {
                console.error('API Error:', error.response?.data || error.message);
                throw error.response?.data || error;
            }
        );
    }

    setToken(token) {
        this.token = token;
    }

    async login(credentials) {
        return this.client.post('/auth/login', credentials);
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
        return this.client.post('/media/sync', data);
    }

    async batchSyncMedia(data) {
        return this.client.post('/media/batch-sync', data);
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
}

module.exports = { ApiService };
