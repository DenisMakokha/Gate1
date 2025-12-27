import axios from 'axios';

// Uses relative URL in production (same domain), absolute in development
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error.response?.data || error);
  }
);

export const authService = {
  login: (credentials) => api.post('/auth/login', credentials),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
  changePassword: (data) => api.post('/auth/change-password', data),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword: (data) => api.post('/auth/reset-password', data),
};

export const dashboardService = {
  getAdmin: (eventId) => api.get('/dashboard/admin', { params: { event_id: eventId } }),
  getGroupLeader: () => api.get('/dashboard/group-leader'),
  getQA: () => api.get('/dashboard/qa'),
  getBackup: () => api.get('/dashboard/backup'),
  getEditor: () => api.get('/dashboard/editor'),
  getWorkflowProgress: (eventId) => api.get('/dashboard/workflow-progress', { params: { event_id: eventId } }),
  getTimeAnalytics: (eventId) => api.get('/dashboard/time-analytics', { params: { event_id: eventId } }),
  getIncidents: (eventId, days) => api.get('/dashboard/incidents', { params: { event_id: eventId, days } }),
  getSdCardLifecycle: (eventId) => api.get('/dashboard/sd-card-lifecycle', { params: { event_id: eventId } }),
  getComparative: (eventId) => api.get('/dashboard/comparative', { params: { event_id: eventId } }),
  getPredictive: (eventId) => api.get('/dashboard/predictive', { params: { event_id: eventId } }),
  getAlerts: (eventId) => api.get('/dashboard/alerts', { params: { event_id: eventId } }),
  getLiveOperations: (eventId) => api.get('/dashboard/live-operations', { params: { event_id: eventId } }),
};

export const eventService = {
  getAll: (params) => api.get('/events', { params }),
  getActive: () => api.get('/events/active'),
  getOne: (id) => api.get(`/events/${id}`),
  create: (data) => api.post('/events', data),
  update: (id, data) => api.put(`/events/${id}`, data),
  activate: (id) => api.post(`/events/${id}/activate`),
  complete: (id) => api.post(`/events/${id}/complete`),
  getStats: (id) => api.get(`/events/${id}/stats`),
};

export const groupService = {
  getAll: (params) => api.get('/groups', { params }),
  getOne: (id) => api.get(`/groups/${id}`),
  create: (data) => api.post('/groups', data),
  update: (id, data) => api.put(`/groups/${id}`, data),
  getMembers: (id) => api.get(`/groups/${id}/members`),
  addMember: (id, userId) => api.post(`/groups/${id}/members`, { user_id: userId }),
  removeMember: (id, userId) => api.delete(`/groups/${id}/members`, { data: { user_id: userId } }),
};

export const mediaService = {
  search: (params) => api.get('/media/search', { params }),
  getStatus: (mediaId) => api.get(`/media/${mediaId}/status`),
  getDownloadUrl: (mediaId) => api.get(`/media/${mediaId}/download-url`),
  logPlayback: (mediaId, data) => api.post(`/media/${mediaId}/log-playback`, data),
  logDownload: (mediaId, data) => api.post(`/media/${mediaId}/log-download`, data),
  getPlaybackSource: (mediaId) => api.get(`/media/${mediaId}/playback-source`),
};

export const issueService = {
  getAll: (params) => api.get('/issues', { params }),
  getOne: (issueId) => api.get(`/issues/${issueId}`),
  acknowledge: (issueId) => api.post(`/issues/${issueId}/acknowledge`),
  resolve: (issueId, notes) => api.post(`/issues/${issueId}/resolve`, { resolution_notes: notes }),
  escalate: (issueId, reason) => api.post(`/issues/${issueId}/escalate`, { reason }),
  getGroupSummary: () => api.get('/issues/group-summary'),
};

export const backupService = {
  getCoverage: (eventId) => api.get('/backup/coverage', { params: { event_id: eventId } }),
  getPending: (params) => api.get('/backup/pending', { params }),
  getDiskStatus: (diskId) => api.get(`/backup/disk/${diskId}`),
  getAnalytics: (eventId) => api.get('/backup/analytics', { params: { event_id: eventId } }),
};

export const agentService = {
  getAll: () => api.get('/agents'),
};

export const userService = {
  getAll: (params) => api.get('/users', { params }),
  getOne: (id) => api.get(`/users/${id}`),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.put(`/users/${id}`, data),
  delete: (id) => api.delete(`/users/${id}`),
  toggleStatus: (id) => api.post(`/users/${id}/toggle-status`),
  assignGroups: (id, groupIds) => api.post(`/users/${id}/groups`, { group_ids: groupIds }),
  getRoles: () => api.get('/users/roles'),
  getEditorsStatus: (params) => api.get('/users/editors-status', { params }),
  // Bulk import and invitations
  bulkImport: (data) => api.post('/users/bulk-import', data),
  downloadTemplate: () => api.get('/users/import-template', { responseType: 'blob' }),
  getInvitations: () => api.get('/users/invitations'),
  createInvitation: (data) => api.post('/users/invitations', data),
  revokeInvitation: (id) => api.delete(`/users/invitations/${id}`),
};

export const auditLogService = {
  getAll: (params) => api.get('/audit-logs', { params }),
  getOne: (id) => api.get(`/audit-logs/${id}`),
  getStats: () => api.get('/audit-logs/stats'),
  getActions: () => api.get('/audit-logs/actions'),
  getEntityTypes: () => api.get('/audit-logs/entity-types'),
};

export const registrationService = {
  register: (data) => api.post('/auth/register', data),
  registerWithInvitation: (data) => api.post('/auth/register/invitation', data),
  checkInvitation: (token) => api.get(`/auth/invitation/${token}`),
  getPending: (params) => api.get('/registrations/pending', { params }),
  sendInvitation: (data) => api.post('/registrations/invite', data),
  approve: (id, data) => api.post(`/registrations/${id}/approve`, data),
  reject: (id, data) => api.post(`/registrations/${id}/reject`, data),
  suspend: (id, data) => api.post(`/registrations/${id}/suspend`, data),
  reactivate: (id) => api.post(`/registrations/${id}/reactivate`),
};

export const settingsService = {
  getAll: (group) => api.get('/settings', { params: { group } }),
  update: (settings) => api.put('/settings', { settings }),
  getSmtp: () => api.get('/settings/smtp'),
  updateSmtp: (data) => api.put('/settings/smtp', data),
  testSmtp: (email) => api.post('/settings/smtp/test', { email }),
  getGeneral: () => api.get('/settings/general'),
  updateGeneral: (data) => api.put('/settings/general', data),
};

export const analyticsService = {
  getOverview: () => api.get('/analytics/overview'),
  getMediaTrends: (days) => api.get('/analytics/media-trends', { params: { days } }),
  getIssuesTrends: (days) => api.get('/analytics/issues-trends', { params: { days } }),
  getUserActivity: (days) => api.get('/analytics/user-activity', { params: { days } }),
};

export const cameraService = {
  getAll: (params) => api.get('/cameras', { params }),
  getOne: (id) => api.get(`/cameras/${id}`),
  create: (data) => api.post('/cameras', data),
  update: (id, data) => api.put(`/cameras/${id}`, data),
  delete: (id) => api.delete(`/cameras/${id}`),
  getStats: () => api.get('/cameras/stats'),
  bindSdCard: (id, sdCardId) => api.post(`/cameras/${id}/bind-sd`, { sd_card_id: sdCardId }),
  unbindSdCard: (id) => api.post(`/cameras/${id}/unbind-sd`),
};

export const healingCaseService = {
  getAll: (params) => api.get('/healing-cases', { params }),
  getOne: (id) => api.get(`/healing-cases/${id}`),
  create: (data) => api.post('/healing-cases', data),
  update: (id, data) => api.put(`/healing-cases/${id}`, data),
  delete: (id) => api.delete(`/healing-cases/${id}`),
  getStats: () => api.get('/healing-cases/stats'),
  verify: (id) => api.post(`/healing-cases/${id}/verify`),
  publish: (id) => api.post(`/healing-cases/${id}/publish`),
};

export const exportService = {
  exportMedia: (params) => api.get('/export/media', { params, responseType: 'blob' }),
  exportIssues: (params) => api.get('/export/issues', { params, responseType: 'blob' }),
  exportAuditLogs: (params) => api.get('/export/audit-logs', { params, responseType: 'blob' }),
  exportHealingCases: (params) => api.get('/export/healing-cases', { params, responseType: 'blob' }),
};

export const qualityControlService = {
  getOverview: (eventId) => api.get('/quality-control', { params: { event_id: eventId } }),
  getDashboard: (eventId) => api.get('/quality-control', { params: { event_id: eventId } }),
  getQueue: (params) => api.get('/quality-control/queue', { params }),
  submit: (mediaId, data) => api.post(`/quality-control/${mediaId}/submit`, data),
  getHistory: (mediaId) => api.get(`/quality-control/${mediaId}/history`),
  getStats: (params) => api.get('/quality-control/stats', { params }),
};

export const storageForecastService = {
  getForecast: (params) => api.get('/storage', { params }),
  getUsage: () => api.get('/storage'),
  getDisks: () => api.get('/storage'),
};

export const storageService = {
  getForecast: (params) => api.get('/storage', { params }),
  getUsage: () => api.get('/storage'),
  getDisks: () => api.get('/storage'),
};

export const mediaDeletionService = {
  getPending: (params) => api.get('/media-deletion/pending', { params }),
  request: (mediaId, reason) => api.post(`/media-deletion/${mediaId}/request`, { reason }),
  approve: (requestId) => api.post(`/media-deletion/${requestId}/approve`),
  reject: (requestId, reason) => api.post(`/media-deletion/${requestId}/reject`, { reason }),
};

export const workAllocationService = {
  getOverview: () => api.get('/work-allocation/overview'),
  assign: (editorId, mediaIds) => api.post('/work-allocation/assign', { editor_id: editorId, media_ids: mediaIds }),
  autoDistribute: (params) => api.post('/work-allocation/auto-distribute', params),
  reassign: (fromEditorId, toEditorId, mediaIds) => api.post('/work-allocation/reassign', {
    from_editor_id: fromEditorId,
    to_editor_id: toEditorId,
    media_ids: mediaIds,
  }),
};

export default api;
