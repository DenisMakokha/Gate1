import { EventEmitter } from 'events';
import chokidar, { FSWatcher } from 'chokidar';
import { promises as fs } from 'fs';
import path from 'path';

export type CopyCandidate = {
  fullPath: string;
  filename: string;
  sizeBytes: number;
};

export type RenameEvent = {
  oldPath: string;
  newPath: string;
  oldName: string;
  newName: string;
  sizeBytes: number;
};

export class CopyObserver extends EventEmitter {
  private watcher: FSWatcher | null = null;
  private watched: string[] = [];

  private recentlyUnlinked: Array<{ fullPath: string; dir: string; sizeBytes: number; ts: number }> = [];
  private readonly renameWindowMs = 2500;

  start(folders: string[]) {
    this.stop();
    this.watched = folders;

    if (!folders.length) return;

    this.watcher = chokidar.watch(folders, {
      ignoreInitial: true,
      persistent: true,
      awaitWriteFinish: {
        stabilityThreshold: 1500,
        pollInterval: 250,
      },
      depth: 8,
    });

    this.watcher.on('add', (filePath: string) => {
      void this.handleAdd(filePath);
    });

    this.watcher.on('unlink', (filePath: string) => {
      void this.handleUnlink(filePath);
    });

    this.watcher.on('error', (err: unknown) => {
      this.emit('error', err);
    });
  }

  stop() {
    if (this.watcher) {
      void this.watcher.close();
      this.watcher = null;
    }
  }

  getWatchedFolders(): string[] {
    return this.watched;
  }

  private async handleAdd(filePath: string): Promise<void> {
    // Only care about video files (cheap filter)
    const ext = path.extname(filePath).toLowerCase();
    const videoExts = new Set(['.mp4', '.mov', '.avi', '.mkv', '.mts', '.m2ts']);
    if (!videoExts.has(ext)) return;

    let st;
    try {
      st = await fs.stat(filePath);
    } catch {
      return;
    }

    if (!st.isFile()) return;

    const candidate: CopyCandidate = {
      fullPath: filePath,
      filename: path.basename(filePath),
      sizeBytes: st.size,
    };

    // Rename detection: if a similarly-sized file was unlinked in the same folder recently,
    // treat this as a rename (best-effort, non-blocking).
    const now = Date.now();
    this.recentlyUnlinked = this.recentlyUnlinked.filter(r => now - r.ts <= this.renameWindowMs);
    const dir = path.dirname(filePath);
    const idx = this.recentlyUnlinked.findIndex(r => r.dir === dir && r.sizeBytes === st.size);
    if (idx >= 0) {
      const old = this.recentlyUnlinked.splice(idx, 1)[0];
      const evt: RenameEvent = {
        oldPath: old.fullPath,
        newPath: filePath,
        oldName: path.basename(old.fullPath),
        newName: path.basename(filePath),
        sizeBytes: st.size,
      };
      this.emit('file-renamed', evt);
    }

    this.emit('file-added', candidate);
  }

  private async handleUnlink(filePath: string): Promise<void> {
    const ext = path.extname(filePath).toLowerCase();
    const videoExts = new Set(['.mp4', '.mov', '.avi', '.mkv', '.mts', '.m2ts']);
    if (!videoExts.has(ext)) return;

    // Use stored size if possible; if stat fails, skip rename correlation.
    let sizeBytes = 0;
    try {
      const st = await fs.stat(filePath);
      sizeBytes = st.size;
    } catch {
      return;
    }

    const now = Date.now();
    this.recentlyUnlinked = this.recentlyUnlinked.filter(r => now - r.ts <= this.renameWindowMs);
    this.recentlyUnlinked.push({ fullPath: filePath, dir: path.dirname(filePath), sizeBytes, ts: now });

    // Bound memory
    if (this.recentlyUnlinked.length > 200) {
      this.recentlyUnlinked.splice(0, this.recentlyUnlinked.length - 200);
    }
  }
}
