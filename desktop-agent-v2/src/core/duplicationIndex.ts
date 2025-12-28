import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';

export type DuplicateRecord = {
  quickHash: string;
  filename: string;
  sizeBytes: number;
  firstSeenAtIso: string;
  lastSeenAtIso: string;
  eventId?: number;
  serverSessionId?: string;
  sdHardwareId?: string;
};

export class DuplicationIndex {
  private filePath: string;
  private loaded = false;
  private map = new Map<string, DuplicateRecord>();

  constructor(private opts: { dir: string; filename?: string; maxEntries?: number }) {
    this.filePath = path.join(opts.dir, opts.filename ?? 'dup-index.json');
  }

  async init(): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await this.load();
  }

  async load(): Promise<void> {
    if (this.loaded) return;
    try {
      const raw = await fs.readFile(this.filePath, 'utf8');
      const obj = JSON.parse(raw) as Record<string, DuplicateRecord>;
      this.map = new Map(Object.entries(obj));
    } catch {
      this.map = new Map();
    } finally {
      this.loaded = true;
    }
  }

  get(quickHash: string): DuplicateRecord | null {
    return this.map.get(quickHash) ?? null;
  }

  count(): number {
    return this.map.size;
  }

  async upsert(record: Omit<DuplicateRecord, 'firstSeenAtIso' | 'lastSeenAtIso'> & { seenAtIso?: string }): Promise<void> {
    const now = record.seenAtIso ?? new Date().toISOString();
    const existing = this.map.get(record.quickHash);
    if (existing) {
      existing.lastSeenAtIso = now;
      existing.filename = record.filename;
      existing.sizeBytes = record.sizeBytes;
      existing.eventId = record.eventId ?? existing.eventId;
      existing.serverSessionId = record.serverSessionId ?? existing.serverSessionId;
      existing.sdHardwareId = record.sdHardwareId ?? existing.sdHardwareId;
    } else {
      this.map.set(record.quickHash, {
        quickHash: record.quickHash,
        filename: record.filename,
        sizeBytes: record.sizeBytes,
        firstSeenAtIso: now,
        lastSeenAtIso: now,
        eventId: record.eventId,
        serverSessionId: record.serverSessionId,
        sdHardwareId: record.sdHardwareId,
      });
    }

    await this.save();
  }

  private async save(): Promise<void> {
    const maxEntries = this.opts.maxEntries ?? 20000;

    // prune oldest if needed (simple heuristic)
    if (this.map.size > maxEntries) {
      const arr = Array.from(this.map.values()).sort((a, b) => a.lastSeenAtIso.localeCompare(b.lastSeenAtIso));
      const keep = arr.slice(arr.length - maxEntries);
      this.map = new Map(keep.map(r => [r.quickHash, r]));
    }

    const obj: Record<string, DuplicateRecord> = {};
    for (const [k, v] of this.map.entries()) obj[k] = v;

    const tmp = `${this.filePath}.${crypto.randomUUID()}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(obj), 'utf8');
    await fs.rename(tmp, this.filePath);
  }
}
