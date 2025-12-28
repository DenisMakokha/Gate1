import { EventEmitter } from 'events';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';

export type IssueSeverity = 'info' | 'warning' | 'error';

export type Issue = {
  id: string;
  createdAtIso: string;
  severity: IssueSeverity;
  code: string;
  message: string;
  data?: unknown;
  acknowledged: boolean;
  acknowledgedAtIso?: string;
};

export class IssueEngine extends EventEmitter {
  private filePath: string;
  private issues: Issue[] = [];
  private loaded = false;

  constructor(private opts: { dir: string; filename?: string; maxIssues?: number }) {
    super();
    this.filePath = path.join(opts.dir, opts.filename ?? 'issues.json');
  }

  async init(): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await this.load();
  }

  async load(): Promise<void> {
    if (this.loaded) return;
    try {
      const raw = await fs.readFile(this.filePath, 'utf8');
      const arr = JSON.parse(raw) as Issue[];
      this.issues = Array.isArray(arr) ? arr : [];
    } catch {
      this.issues = [];
    } finally {
      this.loaded = true;
    }
  }

  list(): Issue[] {
    // newest first
    return [...this.issues].sort((a, b) => b.createdAtIso.localeCompare(a.createdAtIso));
  }

  async add(issue: Omit<Issue, 'id' | 'createdAtIso' | 'acknowledged'> & { acknowledged?: boolean }): Promise<Issue> {
    const now = new Date().toISOString();
    const it: Issue = {
      id: `ISS-${crypto.randomUUID()}`,
      createdAtIso: now,
      severity: issue.severity,
      code: issue.code,
      message: issue.message,
      data: issue.data,
      acknowledged: issue.acknowledged ?? false,
    };

    this.issues.push(it);

    const max = this.opts.maxIssues ?? 500;
    if (this.issues.length > max) {
      this.issues.splice(0, this.issues.length - max);
    }

    await this.persist();
    this.emit('updated', this.list());
    return it;
  }

  async acknowledge(id: string): Promise<boolean> {
    const now = new Date().toISOString();
    const it = this.issues.find(i => i.id === id);
    if (!it) return false;
    if (!it.acknowledged) {
      it.acknowledged = true;
      it.acknowledgedAtIso = now;
      await this.persist();
      this.emit('updated', this.list());
    }
    return true;
  }

  async clear(): Promise<void> {
    this.issues = [];
    await this.persist();
    this.emit('updated', this.list());
  }

  private async persist(): Promise<void> {
    const tmp = `${this.filePath}.${crypto.randomUUID()}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(this.issues), 'utf8');
    await fs.rename(tmp, this.filePath);
  }
}
