import axios, { AxiosInstance } from 'axios';

export type LoginResponse = {
  status: 'success';
  user: {
    id: number;
    name: string;
    email: string;
    roles: string[];
  };
  authorization: {
    token: string;
    type: 'bearer';
    expires_in: number;
  };
};

export class ApiClient {
  private client: AxiosInstance;

  constructor(private baseUrl: string) {
    this.client = axios.create({
      baseURL: baseUrl,
      timeout: 30000,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  async getSdCard(hardwareId: string): Promise<any> {
    const res = await this.client.get('/agent/sd-card', { params: { hardware_id: hardwareId } });
    return res.data;
  }

  async endSession(payload: {
    sessionId: string;
    removal_decision: 'safe' | 'early_confirmed';
    files_copied: number;
    files_pending: number;
  }): Promise<any> {
    const res = await this.client.post(`/session/${encodeURIComponent(payload.sessionId)}/end`, {
      removal_decision: payload.removal_decision,
      files_copied: payload.files_copied,
      files_pending: payload.files_pending,
    });
    return res.data;
  }

  async getEvent(eventId: number): Promise<any> {
    const res = await this.client.get(`/events/${eventId}`);
    return res.data;
  }

  async getActiveEvent(): Promise<any | null> {
    const res = await this.client.get('/events/active');
    // backend returns { event: ... } or { event: null }
    return res.data?.event ?? null;
  }

  async startServerSession(payload: {
    event_id: number;
    sd_card_id: number;
    camera_number: number;
    device_id: string;
    files_detected: number;
    total_size_bytes: number;
  }): Promise<any> {
    const res = await this.client.post('/session/start', payload);
    return res.data;
  }

  async updateSessionProgress(payload: {
    sessionId: string;
    files_copied: number;
    files_pending: number;
  }): Promise<any> {
    const res = await this.client.put(`/session/${encodeURIComponent(payload.sessionId)}/progress`, {
      files_copied: payload.files_copied,
      files_pending: payload.files_pending,
    });
    return res.data;
  }

  async bindSdCard(payload: {
    hardware_id: string;
    fs_uuid?: string;
    camera_number: number;
    sd_label: string;
    capacity_bytes?: number;
  }): Promise<any> {
    const res = await this.client.post('/agent/sd-card/bind', payload);
    return res.data;
  }

  async reportIssue(payload: {
    device_id: string;
    issue_id: string;
    severity: string;
    code: string;
    message: string;
    data?: unknown;
    created_at_iso?: string;
    server_session_id?: string | null;
    event_id?: number | null;
  }): Promise<any> {
    const res = await this.client.post('/issues/report', payload);
    return res.data;
  }

  setBaseUrl(baseUrl: string) {
    this.baseUrl = baseUrl;
    this.client.defaults.baseURL = baseUrl;
  }

  setToken(token: string | null) {
    if (token) {
      this.client.defaults.headers.common.Authorization = `Bearer ${token}`;
    } else {
      delete this.client.defaults.headers.common.Authorization;
    }
  }

  async request(params: {
    method: 'POST' | 'PUT' | 'PATCH' | 'GET';
    url: string;
    data?: unknown;
    headers?: Record<string, string>;
    timeoutMs?: number;
  }): Promise<unknown> {
    const res = await this.client.request({
      method: params.method,
      url: params.url,
      data: params.data,
      headers: params.headers,
      timeout: params.timeoutMs ?? 30000,
    });
    return res.data;
  }

  async ping(): Promise<{ online: boolean; latencyMs: number | null }> {
    const start = Date.now();
    try {
      await this.client.get('/health', { timeout: 10000 });
      return { online: true, latencyMs: Date.now() - start };
    } catch {
      return { online: false, latencyMs: null };
    }
  }

  async login(email: string, password: string): Promise<LoginResponse> {
    const res = await this.client.post<LoginResponse>('/auth/login', { email, password });
    return res.data;
  }

  async me(): Promise<any> {
    const res = await this.client.get('/auth/me');
    return res.data;
  }

  async registerAgent(payload: {
    editor_name: string;
    device_id: string;
    os?: string;
    agent_version?: string;
    group_code?: string;
  }): Promise<any> {
    const res = await this.client.post('/agent/register', payload);
    return res.data;
  }

  async agentHeartbeat(payload: {
    agent_id: string;
    device_id: string;
    status: 'online' | 'offline';
    latency_ms?: number;
    watched_folders?: any[];
  }): Promise<any> {
    const res = await this.client.post('/agent/heartbeat', payload);
    return res.data;
  }

  async userHeartbeat(payload: { activity?: string }): Promise<any> {
    const res = await this.client.post('/users/heartbeat', payload);
    return res.data;
  }
}
