import { OfflineQueue } from './offlineQueue';
import { ApiClient } from './apiClient';

export class ProgressReporter {
  private lastSentAt = 0;
  private lastPayloadKey: string | null = null;

  constructor(
    private deps: {
      api: ApiClient;
      queue: OfflineQueue;
      isOnline: () => boolean;
      minIntervalMs?: number;
    }
  ) {}

  async report(params: {
    serverSessionId: string;
    filesCopied: number;
    filesPending: number;
  }): Promise<{ status: 'sent' | 'queued' | 'skipped' }> {
    const minIntervalMs = this.deps.minIntervalMs ?? 5000;

    const key = `${params.serverSessionId}:${params.filesCopied}:${params.filesPending}`;
    if (key === this.lastPayloadKey) {
      return { status: 'skipped' };
    }

    const now = Date.now();
    if (now - this.lastSentAt < minIntervalMs) {
      // don't spam; allow coalescing by just skipping duplicates
      this.lastPayloadKey = key;
      return { status: 'skipped' };
    }

    this.lastSentAt = now;
    this.lastPayloadKey = key;

    const payload = {
      sessionId: params.serverSessionId,
      files_copied: params.filesCopied,
      files_pending: params.filesPending,
    };

    if (!this.deps.isOnline()) {
      this.deps.queue.enqueue({ endpoint: `/session/${params.serverSessionId}/progress`, method: 'PUT', payload });
      return { status: 'queued' };
    }

    try {
      await this.deps.api.updateSessionProgress(payload);
      return { status: 'sent' };
    } catch {
      this.deps.queue.enqueue({ endpoint: `/session/${params.serverSessionId}/progress`, method: 'PUT', payload });
      return { status: 'queued' };
    }
  }
}
