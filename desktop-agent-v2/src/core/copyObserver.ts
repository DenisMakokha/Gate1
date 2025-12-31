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
  
  // Track file sizes for rename detection (file is deleted before we can stat it)
  private fileSizeCache: Map<string, number> = new Map();

  start(folders: string[]) {
    this.stop();
    this.watched = folders;

    if (!folders.length) return;

    // Pre-scan existing files to populate size cache for rename detection
    void this.scanExistingFiles(folders);

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
    this.fileSizeCache.clear();
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

    // Cache file size for rename detection
    this.fileSizeCache.set(filePath, st.size);
    
    // Bound cache size
    if (this.fileSizeCache.size > 5000) {
      const keys = Array.from(this.fileSizeCache.keys());
      for (let i = 0; i < 1000; i++) {
        this.fileSizeCache.delete(keys[i]);
      }
    }

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

    // Use cached size - file is already deleted so we can't stat it
    const sizeBytes = this.fileSizeCache.get(filePath);
    if (!sizeBytes) {
      // File wasn't in our cache (maybe existed before watcher started)
      // Skip rename correlation for this file
      return;
    }
    
    // Remove from cache
    this.fileSizeCache.delete(filePath);

    const now = Date.now();
    this.recentlyUnlinked = this.recentlyUnlinked.filter(r => now - r.ts <= this.renameWindowMs);
    this.recentlyUnlinked.push({ fullPath: filePath, dir: path.dirname(filePath), sizeBytes, ts: now });

    // Bound memory
    if (this.recentlyUnlinked.length > 200) {
      this.recentlyUnlinked.splice(0, this.recentlyUnlinked.length - 200);
    }
  }

  /**
   * Scan existing files in watched folders to populate size cache.
   * This enables rename detection for files that existed before the watcher started.
   */
  private async scanExistingFiles(folders: string[]): Promise<void> {
    const videoExts = new Set(['.mp4', '.mov', '.avi', '.mkv', '.mts', '.m2ts']);
    
    for (const folder of folders) {
      try {
        await this.scanDirectory(folder, videoExts, 0, 8);
      } catch {
        // Folder might not exist or be inaccessible
      }
    }
  }

  private async scanDirectory(dir: string, videoExts: Set<string>, depth: number, maxDepth: number): Promise<void> {
    if (depth > maxDepth) return;
    
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          await this.scanDirectory(fullPath, videoExts, depth + 1, maxDepth);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (videoExts.has(ext)) {
            try {
              const st = await fs.stat(fullPath);
              this.fileSizeCache.set(fullPath, st.size);
            } catch {
              // File might have been deleted
            }
          }
        }
      }
    } catch {
      // Directory might not be accessible
    }
    
    // Bound cache size during scan
    if (this.fileSizeCache.size > 10000) {
      const keys = Array.from(this.fileSizeCache.keys());
      for (let i = 0; i < 2000; i++) {
        this.fileSizeCache.delete(keys[i]);
      }
    }
  }
}
