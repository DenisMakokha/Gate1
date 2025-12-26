import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Production: https://api.gate1.cloud/api
// Development: http://localhost:8000/api
const API_BASE_URL = __DEV__ 
  ? 'http://localhost:8000/api' 
  : 'https://api.gate1.cloud/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    console.error('API Error:', error.response?.data || error.message);
    throw error.response?.data || error;
  }
);

export const authService = {
  login: (credentials) => api.post('/auth/login', credentials),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
};

export const dashboardService = {
  getAdmin: () => api.get('/dashboard/admin'),
  getGroupLeader: () => api.get('/dashboard/group-leader'),
  getQA: () => api.get('/dashboard/qa'),
  getBackup: () => api.get('/dashboard/backup'),
  getEditor: () => api.get('/dashboard/editor'),
  getWorkflowProgress: (eventId) => api.get('/dashboard/workflow-progress', { params: { event_id: eventId } }),
  getLiveOperations: (eventId) => api.get('/dashboard/live-operations', { params: { event_id: eventId } }),
};

export const issueService = {
  getAll: (params) => api.get('/issues', { params }),
  getOne: (issueId) => api.get(`/issues/${issueId}`),
  acknowledge: (issueId) => api.post(`/issues/${issueId}/acknowledge`),
  resolve: (issueId, notes) => api.post(`/issues/${issueId}/resolve`, { resolution_notes: notes }),
  escalate: (issueId, reason) => api.post(`/issues/${issueId}/escalate`, { reason }),
  getGroupSummary: () => api.get('/issues/group-summary'),
};

export const groupService = {
  getAll: (params) => api.get('/groups', { params }),
  getOne: (id) => api.get(`/groups/${id}`),
  getMembers: (id) => api.get(`/groups/${id}/members`),
};

export const backupService = {
  getCoverage: () => api.get('/backup/coverage'),
  getPending: (params) => api.get('/backup/pending', { params }),
  getAnalytics: (eventId) => api.get('/backup/analytics', { params: { event_id: eventId } }),
  getPendingByEditor: () => api.get('/backup/pending-by-editor'),
  getPendingByGroup: () => api.get('/backup/pending-by-group'),
  getEditorDiskAssignments: () => api.get('/backup/editor-disk-assignments'),
  getTeamPendingTotal: () => api.get('/backup/team-pending-total'),
};

export const mediaService = {
  search: (params) => api.get('/media/search', { params }),
  getStatus: (mediaId) => api.get(`/media/${mediaId}/status`),
  getDownloadUrl: (mediaId) => api.get(`/media/${mediaId}/download-url`),
  logPlayback: (mediaId, data) => api.post(`/media/${mediaId}/log-playback`, data),
  logDownload: (mediaId, data) => api.post(`/media/${mediaId}/log-download`, data),
  getPlaybackSource: (mediaId) => api.get(`/media/${mediaId}/playback-source`),
};

export const userService = {
  getEditorsStatus: (params) => api.get('/users/editors-status', { params }),
};

export const activityFeedService = {
  getAll: (params) => api.get('/activity-feed', { params }),
  getTimeline: (eventId) => api.get('/activity-feed/timeline', { params: { event_id: eventId } }),
  getStats: (eventId) => api.get('/activity-feed/stats', { params: { event_id: eventId } }),
};

export const shiftService = {
  getAll: (params) => api.get('/shifts', { params }),
  getMyShifts: () => api.get('/shifts/my-shifts'),
  getTodayOverview: (eventId) => api.get('/shifts/today-overview', { params: { event_id: eventId } }),
  checkIn: (shiftId) => api.post(`/shifts/${shiftId}/check-in`),
  checkOut: (shiftId) => api.post(`/shifts/${shiftId}/check-out`),
  getHandoff: (handoffId) => api.get(`/shifts/handoff/${handoffId}`),
  acknowledgeHandoff: (handoffId) => api.post(`/shifts/handoff/${handoffId}/acknowledge`),
};

export const storageService = {
  getOverview: (eventId) => api.get('/storage', { params: { event_id: eventId } }),
  getDiskDetail: (diskId) => api.get(`/storage/disk/${diskId}`),
};

export const qualityControlService = {
  getOverview: (eventId) => api.get('/quality-control', { params: { event_id: eventId } }),
  getNeedsTraining: (params) => api.get('/quality-control/needs-training', { params }),
};

export const reportService = {
  getDailySummary: (date, eventId) => api.get('/reports/daily-summary', { params: { date, event_id: eventId } }),
};

export default api;
