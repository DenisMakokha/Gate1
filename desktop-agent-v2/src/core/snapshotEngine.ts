import { EventEmitter } from 'events';
import { promises as fs } from 'fs';
import fsSync from 'fs';
import path from 'path';
import crypto from 'crypto';

export type SnapshotFile = {
  relativePath: string;
  name: string;
  sizeBytes: number;
  createdAtIso?: string;
  modifiedAtIso?: string;
  quickHash: string; // sha256 of (head+tail+size) for large files or full for small
};

export type SnapshotResult = {
  snapshotId: string;
  sessionId: string;
  sdHardwareId: string;
  mountPath: string;
  createdAtIso: string;
  fileCount: number;
  totalSizeBytes: number;
  files: SnapshotFile[];
};

export type SnapshotProgress = {
  sessionId: string;
  scannedFiles: number;
  totalSizeBytes: number;
  currentPath?: string;
};

export class SnapshotEngine extends EventEmitter {
  private running = false;

  constructor(private opts: { outDir: string }) {
    super();
  }

  isRunning(): boolean {
    return this.running;
  }

  async loadSnapshot(sessionId: string): Promise<SnapshotResult | null> {
    const p = this.getSnapshotPath(sessionId);
    try {
      const raw = await fs.readFile(p, 'utf8');
      return JSON.parse(raw) as SnapshotResult;
    } catch {
      return null;
    }
  }

  async createSnapshot(params: { sessionId: string; sdHardwareId: string; mountPath: string }): Promise<SnapshotResult> {
    if (this.running) {
      throw new Error('snapshot_already_running');
    }

    this.running = true;
    try {
      await fs.mkdir(this.opts.outDir, { recursive: true });

      const createdAtIso = new Date().toISOString();
      const snapshotId = `SNAP-${params.sessionId}-${Date.now()}`;

      const files: SnapshotFile[] = [];
      let scannedFiles = 0;
      let totalSizeBytes = 0;

      const videoExts = new Set(['.mp4', '.mov', '.avi', '.mkv', '.mts', '.m2ts']);
      const maxDepth = 6; // safe guard

      const walk = async (dir: string, depth: number) => {
        if (depth > maxDepth) return;

        let entries: fsSync.Dirent[];
        try {
          entries = await fs.readdir(dir, { withFileTypes: true });
        } catch {
          return;
        }

        for (const ent of entries) {
          if (ent.name.startsWith('.')) continue;
          const full = path.join(dir, ent.name);

          if (ent.isDirectory()) {
            await walk(full, depth + 1);
            continue;
          }

          if (!ent.isFile()) continue;

          const ext = path.extname(ent.name).toLowerCase();
          if (!videoExts.has(ext)) continue;

          let st: fsSync.Stats;
          try {
            st = await fs.stat(full);
          } catch {
            continue;
          }

          const rel = path.relative(params.mountPath, full);
          const quickHash = await this.computeQuickHash(full, st.size);

          files.push({
            relativePath: rel,
            name: ent.name,
            sizeBytes: st.size,
            createdAtIso: st.birthtime ? new Date(st.birthtime).toISOString() : undefined,
            modifiedAtIso: st.mtime ? new Date(st.mtime).toISOString() : undefined,
            quickHash,
          });

          scannedFiles += 1;
          totalSizeBytes += st.size;

          if (scannedFiles % 10 === 0) {
            this.emit('progress', {
              sessionId: params.sessionId,
              scannedFiles,
              totalSizeBytes,
              currentPath: rel,
            } satisfies SnapshotProgress);
          }
        }
      };

      await walk(params.mountPath, 0);

      const result: SnapshotResult = {
        snapshotId,
        sessionId: params.sessionId,
        sdHardwareId: params.sdHardwareId,
        mountPath: params.mountPath,
        createdAtIso,
        fileCount: files.length,
        totalSizeBytes,
        files,
      };

      await this.persistSnapshot(result);

      this.emit('complete', result);
      return result;
    } catch (e) {
      this.emit('error', e);
      throw e;
    } finally {
      this.running = false;
    }
  }

  private getSnapshotPath(sessionId: string): string {
    return path.join(this.opts.outDir, `${sessionId}.json`);
  }

  private async persistSnapshot(result: SnapshotResult): Promise<void> {
    const p = this.getSnapshotPath(result.sessionId);
    const tmp = `${p}.${crypto.randomUUID()}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(result), 'utf8');
    await fs.rename(tmp, p);
  }

  private async computeQuickHash(filePath: string, fileSize: number): Promise<string> {
    const LARGE = 100 * 1024 * 1024;
    const CHUNK = 1024 * 1024;

    const hash = crypto.createHash('sha256');

    if (fileSize <= LARGE) {
      // full stream
      return new Promise((resolve, reject) => {
        const stream = fsSync.createReadStream(filePath);
        stream.on('data', (d) => hash.update(d));
        stream.on('end', () => resolve(hash.digest('hex')));
        stream.on('error', reject);
      });
    }

    // head + tail + size for large files
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
