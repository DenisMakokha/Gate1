import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

export type QueueItem = {
  id: string;
  createdAt: string;
  endpoint: string;
  method: 'POST' | 'PUT' | 'PATCH';
  payload: unknown;
  headers?: Record<string, string>;
  attempts: number;
  nextAttemptAt: number; // epoch ms
};

export type OfflineQueueOptions = {
  dir: string;
  filename?: string;
  maxItems?: number;
  maxBatch?: number;
  minBackoffMs?: number;
  maxBackoffMs?: number;
};

export class OfflineQueue {
  private filePath: string;
  private maxItems: number;
  private maxBatch: number;
  private minBackoffMs: number;
  private maxBackoffMs: number;

  private items: QueueItem[] = [];
  private loaded = false;
  private saving = false;
  private savePending = false;
  private draining = false;

  constructor(opts: OfflineQueueOptions) {
    this.filePath = path.join(opts.dir, opts.filename ?? 'offline-queue.json');
    this.maxItems = opts.maxItems ?? 5000;
    this.maxBatch = opts.maxBatch ?? 20;
    this.minBackoffMs = opts.minBackoffMs ?? 5_000;
    this.maxBackoffMs = opts.maxBackoffMs ?? 10 * 60_000;
  }

  async init(): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await this.load();
  }

  async load(): Promise<void> {
    if (this.loaded) return;
    try {
      const raw = await fs.readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(raw);
      this.items = Array.isArray(parsed) ? parsed : [];
    } catch {
      this.items = [];
    } finally {
      this.loaded = true;
    }
  }

  size(): number {
    return this.items.length;
  }

  enqueue(params: { endpoint: string; method: QueueItem['method']; payload: unknown; headers?: Record<string, string> }): QueueItem {
    const item: QueueItem = {
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      endpoint: params.endpoint,
      method: params.method,
      payload: params.payload,
      headers: {
        ...params.headers,
        // always provide an idempotency key unless caller already set one
        ...(params.headers?.['Idempotency-Key'] ? {} : { 'Idempotency-Key': randomUUID() }),
      },
      attempts: 0,
      nextAttemptAt: Date.now(),
    };

    this.items.push(item);

    // bounded memory/disk
    if (this.items.length > this.maxItems) {
      this.items.splice(0, this.items.length - this.maxItems);
    }

    this.scheduleSave();
    return item;
  }

  async drain(params: {
    isOnline: () => boolean;
    send: (item: QueueItem) => Promise<void>;
    nowMs?: () => number;
    maxProcessed?: number;
    timeBudgetMs?: number;
  }): Promise<{ processed: number; remaining: number }> {
    if (this.draining) return { processed: 0, remaining: this.items.length };
    this.draining = true;

    const nowMs = params.nowMs ?? (() => Date.now());
    const startedAt = nowMs();
    const maxProcessed = params.maxProcessed ?? this.maxBatch;
    const timeBudgetMs = params.timeBudgetMs ?? 1500;

    try {
      if (!params.isOnline()) return { processed: 0, remaining: this.items.length };

      let processed = 0;
      const now = nowMs();

      // process in small batches for UI responsiveness (and time-bounded)
      const due = this.items.filter(i => i.nextAttemptAt <= now);
      const batch = due.slice(0, maxProcessed);

      for (const item of batch) {
        if (processed >= maxProcessed) break;
        if (nowMs() - startedAt > timeBudgetMs) break;
        try {
          await params.send(item);
          // remove on success
          this.items = this.items.filter(i => i.id !== item.id);
          processed++;
        } catch {
          // schedule retry
          item.attempts += 1;
          const backoff = this.computeBackoffMs(item.attempts);
          item.nextAttemptAt = nowMs() + backoff;
        }
      }

      if (processed > 0) {
        await this.saveNow();
      } else {
        this.scheduleSave();
      }

      return { processed, remaining: this.items.length };
    } finally {
      this.draining = false;
    }
  }

  private computeBackoffMs(attempt: number): number {
    const exp = Math.min(this.maxBackoffMs, this.minBackoffMs * Math.pow(2, Math.max(0, attempt - 1)));
    const jitter = Math.floor(Math.random() * Math.min(1000, exp * 0.1));
    return Math.min(this.maxBackoffMs, exp + jitter);
  }

  private scheduleSave(): void {
    if (this.saving) {
      this.savePending = true;
      return;
    }

    // debounce-ish: next tick
    setTimeout(() => {
      this.saveNow().catch(() => undefined);
    }, 0);
  }

  private async saveNow(): Promise<void> {
    if (this.saving) {
      this.savePending = true;
      return;
    }

    this.saving = true;
    try {
      const tmp = `${this.filePath}.${randomUUID()}.tmp`;
      await fs.writeFile(tmp, JSON.stringify(this.items), 'utf8');
      await fs.rename(tmp, this.filePath);
    } finally {
      this.saving = false;
      if (this.savePending) {
        this.savePending = false;
        await this.saveNow();
      }
    }
  }
}
