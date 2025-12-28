import { EventEmitter } from 'events';
import { promises as fs } from 'fs';
import fsSync from 'fs';
import path from 'path';
import crypto from 'crypto';

import type { SnapshotResult, SnapshotFile } from './snapshotEngine';

export type BackupProgress = {
  sessionId: string;
  totalFiles: number;
  completedFiles: number;
  totalBytes: number;
  copiedBytes: number;
  currentRelativePath?: string;
  failedFiles: number;
};

export type BackupFileError = {
  sessionId: string;
  relativePath: string;
  message: string;
};

export type BackupState = {
  sessionId: string;
  destRoot: string;
  startedAtIso: string;
  updatedAtIso: string;
  completedRelativePaths: string[];
  failedRelativePaths: string[];
  copiedBytes: number;
};

export class BackupEngine extends EventEmitter {
  private running = false;
  private paused = false;
  private current: {
    snapshot: SnapshotResult;
    destRoot: string;
    statePath: string;
    state: BackupState;
    completed: Set<string>;
    failed: Set<string>;
  } | null = null;

  constructor(private opts: { stateDir: string }) {
    super();
  }

  isRunning(): boolean {
    return this.running;
  }

  isPaused(): boolean {
    return this.paused;
  }

  getStatus():
    | {
        running: boolean;
        paused: boolean;
        sessionId: string;
        destRoot: string;
        completedFiles: number;
        failedFiles: number;
        totalFiles: number;
        copiedBytes: number;
        totalBytes: number;
      }
    | null {
    const cur = this.current;
    if (!cur) return null;
    return {
      running: this.running,
      paused: this.paused,
      sessionId: cur.snapshot.sessionId,
      destRoot: cur.destRoot,
      completedFiles: cur.completed.size,
      failedFiles: cur.failed.size,
      totalFiles: cur.snapshot.files.length,
      copiedBytes: cur.state.copiedBytes,
      totalBytes: cur.snapshot.totalSizeBytes,
    };
  }

  async clearFailed(): Promise<void> {
    const cur = this.current;
    if (!cur) return;
    cur.failed = new Set();
    cur.state.failedRelativePaths = [];
    cur.state.updatedAtIso = new Date().toISOString();
    await this.persistState();
    this.emitProgress();
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    if (!this.current) return;
    if (!this.running) return;
    this.paused = false;
    void this.loop();
  }

  async start(params: { snapshot: SnapshotResult; destRoot: string }): Promise<void> {
    if (this.running) throw new Error('backup_already_running');

    this.running = true;
    this.paused = false;

    await fs.mkdir(this.opts.stateDir, { recursive: true });

    const statePath = path.join(this.opts.stateDir, `${params.snapshot.sessionId}.json`);
    const loaded = await this.loadState(statePath);

    const startedAtIso = loaded?.startedAtIso ?? new Date().toISOString();
    const state: BackupState = {
      sessionId: params.snapshot.sessionId,
      destRoot: params.destRoot,
      startedAtIso,
      updatedAtIso: new Date().toISOString(),
      completedRelativePaths: loaded?.completedRelativePaths ?? [],
      failedRelativePaths: loaded?.failedRelativePaths ?? [],
      copiedBytes: loaded?.copiedBytes ?? 0,
    };

    const completed = new Set(state.completedRelativePaths);
    const failed = new Set(state.failedRelativePaths);

    this.current = {
      snapshot: params.snapshot,
      destRoot: params.destRoot,
      statePath,
      state,
      completed,
      failed,
    };

    this.emitProgress();
    await this.persistState();

    await this.loop();
  }

  stop(): void {
    this.paused = false;
    this.running = false;
    this.current = null;
  }

  private async loop(): Promise<void> {
    const cur = this.current;
    if (!cur) return;

    const totalFiles = cur.snapshot.files.length;

    for (const f of cur.snapshot.files) {
      if (!this.running) return;
      if (this.paused) return;
      if (cur.completed.has(f.relativePath)) continue;

      // If it previously failed, skip for now (manual retry can clear state later)
      if (cur.failed.has(f.relativePath)) continue;

      try {
        await this.copyOne(cur.snapshot, cur.destRoot, f);
        cur.completed.add(f.relativePath);
        cur.state.completedRelativePaths = Array.from(cur.completed);
        cur.state.copiedBytes += f.sizeBytes;
        cur.state.updatedAtIso = new Date().toISOString();

        this.emitProgress(f.relativePath);
        await this.persistState();
      } catch (e: any) {
        const msg = e?.message ?? 'unknown';
        cur.failed.add(f.relativePath);
        cur.state.failedRelativePaths = Array.from(cur.failed);
        cur.state.updatedAtIso = new Date().toISOString();
        await this.persistState();

        const ev: BackupFileError = {
          sessionId: cur.snapshot.sessionId,
          relativePath: f.relativePath,
          message: msg,
        };
        this.emit('file-error', ev);
        // continue
      }

      // yield to keep main thread responsive
      await new Promise<void>((resolve) => setImmediate(resolve));
    }

    this.emit('complete', {
      sessionId: cur.snapshot.sessionId,
      destRoot: cur.destRoot,
      totalFiles,
      completedFiles: cur.completed.size,
      failedFiles: cur.failed.size,
    });

    // keep state file for resumability / audit; caller can clean later if desired.
    this.running = false;
  }

  private emitProgress(currentRelativePath?: string) {
    const cur = this.current;
    if (!cur) return;

    const totalBytes = cur.snapshot.totalSizeBytes;
    const totalFiles = cur.snapshot.files.length;
    const completedFiles = cur.completed.size;

    const payload: BackupProgress = {
      sessionId: cur.snapshot.sessionId,
      totalFiles,
      completedFiles,
      totalBytes,
      copiedBytes: cur.state.copiedBytes,
      currentRelativePath,
      failedFiles: cur.failed.size,
    };

    this.emit('progress', payload);
  }

  private async persistState(): Promise<void> {
    const cur = this.current;
    if (!cur) return;

    const tmp = `${cur.statePath}.${crypto.randomUUID()}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(cur.state), 'utf8');
    await fs.rename(tmp, cur.statePath);
  }

  private async loadState(statePath: string): Promise<BackupState | null> {
    try {
      const raw = await fs.readFile(statePath, 'utf8');
      return JSON.parse(raw) as BackupState;
    } catch {
      return null;
    }
  }

  private async copyOne(snapshot: SnapshotResult, destRoot: string, f: SnapshotFile): Promise<void> {
    const src = path.join(snapshot.mountPath, f.relativePath);
    const dst = path.join(destRoot, snapshot.sessionId, f.relativePath);

    await fs.mkdir(path.dirname(dst), { recursive: true });

    // If destination exists and matches quickHash, treat as already copied.
    try {
      const st = await fs.stat(dst);
      if (st.isFile() && st.size === f.sizeBytes) {
        const dh = await this.computeQuickHash(dst, st.size);
        if (dh === f.quickHash) return;
      }
    } catch {
      // ignore
    }

    await fs.copyFile(src, dst);

    // verify
    const st2 = await fs.stat(dst);
    if (st2.size !== f.sizeBytes) {
      throw new Error(`backup_verify_size_mismatch:${f.relativePath}`);
    }

    const dh2 = await this.computeQuickHash(dst, st2.size);
    if (dh2 !== f.quickHash) {
      throw new Error(`backup_verify_hash_mismatch:${f.relativePath}`);
    }
  }

  private async computeQuickHash(filePath: string, fileSize: number): Promise<string> {
    const LARGE = 100 * 1024 * 1024;
    const CHUNK = 1024 * 1024;

    const hash = crypto.createHash('sha256');

    if (fileSize <= LARGE) {
      return new Promise((resolve, reject) => {
        const stream = fsSync.createReadStream(filePath);
        stream.on('data', (d) => hash.update(d));
        stream.on('end', () => resolve(hash.digest('hex')));
        stream.on('error', reject);
      });
    }

    const fd = fsSync.openSync(filePath, 'r');
    try {
      const head = Buffer.alloc(CHUNK);
      const tail = Buffer.alloc(CHUNK);
      fsSync.readSync(fd, head, 0, CHUNK, 0);
      fsSync.readSync(fd, tail, 0, CHUNK, Math.max(0, fileSize - CHUNK));
      hash.update(head);
      hash.update(tail);
      hash.update(String(fileSize));
      return hash.digest('hex');
    } finally {
      fsSync.closeSync(fd);
    }
  }
}
