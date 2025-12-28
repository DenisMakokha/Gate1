import { promises as fs } from 'fs';
import path from 'path';

export type AuditRecord = {
  ts: string;
  level: 'info' | 'warn' | 'error';
  type: string;
  data?: unknown;
};

export class AuditLogger {
  private filePath: string;
  private maxBytes: number;
  private maxFiles: number;
  private queue: string[] = [];
  private flushing = false;

  constructor(params: { dir: string; filename?: string; maxBytes?: number; maxFiles?: number }) {
    const filename = params.filename ?? 'audit.jsonl';
    this.filePath = path.join(params.dir, filename);
    this.maxBytes = params.maxBytes ?? 5 * 1024 * 1024;
    this.maxFiles = params.maxFiles ?? 7;
  }

  async init(): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
  }

  log(level: AuditRecord['level'], type: string, data?: unknown): void {
    const rec: AuditRecord = {
      ts: new Date().toISOString(),
      level,
      type,
      data,
    };

    this.queue.push(JSON.stringify(rec));
    this.flush().catch(() => {
      // last resort: ignore; we never want to crash the agent because logging failed
    });
  }

  info(type: string, data?: unknown) {
    this.log('info', type, data);
  }

  warn(type: string, data?: unknown) {
    this.log('warn', type, data);
  }

  error(type: string, data?: unknown) {
    this.log('error', type, data);
  }

  private async flush(): Promise<void> {
    if (this.flushing) return;
    if (this.queue.length === 0) return;

    this.flushing = true;
    try {
      await this.rotateIfNeeded();

      // batch write
      const lines = this.queue.splice(0, this.queue.length);
      await fs.appendFile(this.filePath, lines.join('\n') + '\n', 'utf8');
    } finally {
      this.flushing = false;
      if (this.queue.length > 0) {
        // new items arrived during flush
        this.flush().catch(() => undefined);
      }
    }
  }

  private async rotateIfNeeded(): Promise<void> {
    try {
      const st = await fs.stat(this.filePath);
      if (st.size < this.maxBytes) return;

      // rotate: audit.jsonl -> audit.jsonl.1, etc
      for (let i = this.maxFiles - 1; i >= 1; i--) {
        const src = `${this.filePath}.${i}`;
        const dst = `${this.filePath}.${i + 1}`;
        try {
          await fs.rename(src, dst);
        } catch {
          // ignore missing
        }
      }

      await fs.rename(this.filePath, `${this.filePath}.1`);

      // prune oldest
      const prune = `${this.filePath}.${this.maxFiles + 1}`;
      try {
        await fs.unlink(prune);
      } catch {
        // ignore
      }
    } catch {
      // file may not exist yet
    }
  }
}
