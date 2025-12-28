import { EventEmitter } from 'events';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { spawn } from 'child_process';
import ffprobeStatic from 'ffprobe-static';

export type MediaMetadata = {
  durationSec?: number;
  width?: number;
  height?: number;
  codec?: string;
  fps?: number;
  format?: string;
  sizeBytes?: number;
  raw?: any;
};

export type MetadataResult =
  | { ok: true; metadata: MediaMetadata; cached: boolean }
  | { ok: false; reason: 'ffprobe_not_found' | 'ffprobe_failed' | 'file_not_found' | 'unknown'; details?: string };

export class MediaMetadataEngine extends EventEmitter {
  private dir: string;
  private inFlight = new Map<string, Promise<MetadataResult>>();

  constructor(opts: { dir: string }) {
    super();
    this.dir = opts.dir;
  }

  async init(): Promise<void> {
    await fs.mkdir(this.dir, { recursive: true });
  }

  async get(params: { sessionId: string; relativePath: string; fullPath: string }): Promise<MetadataResult> {
    const key = `${params.sessionId}:${params.relativePath}`;
    const existing = this.inFlight.get(key);
    if (existing) return existing;

    const p = this.getImpl(params).finally(() => this.inFlight.delete(key));
    this.inFlight.set(key, p);
    return p;
  }

  private async getImpl(params: { sessionId: string; relativePath: string; fullPath: string }): Promise<MetadataResult> {
    // cache path
    const cachePath = path.join(this.dir, `${sanitize(params.sessionId)}.json`);
    const cache = await this.loadCache(cachePath);
    const hit = cache[params.relativePath];
    if (hit) return { ok: true, metadata: hit, cached: true };

    // ensure file exists
    try {
      await fs.stat(params.fullPath);
    } catch {
      return { ok: false, reason: 'file_not_found' };
    }

    const res = await runFfprobe(params.fullPath);
    if (!res.ok) return res;

    cache[params.relativePath] = res.metadata;
    await this.saveCache(cachePath, cache);

    return { ok: true, metadata: res.metadata, cached: false };
  }

  private async loadCache(p: string): Promise<Record<string, MediaMetadata>> {
    try {
      const raw = await fs.readFile(p, 'utf8');
      const obj = JSON.parse(raw) as Record<string, MediaMetadata>;
      return obj && typeof obj === 'object' ? obj : {};
    } catch {
      return {};
    }
  }

  private async saveCache(p: string, obj: Record<string, MediaMetadata>): Promise<void> {
    const tmp = `${p}.${crypto.randomUUID()}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(obj), 'utf8');
    await fs.rename(tmp, p);
  }
}

function sanitize(s: string): string {
  return s.replace(/[^a-zA-Z0-9._-]/g, '_');
}

async function runFfprobe(filePath: string): Promise<MetadataResult & { ok: boolean; metadata?: MediaMetadata }>{
  // Prefer bundled ffprobe (ffprobe-static), fallback to system ffprobe.
  return new Promise((resolve) => {
    const args = ['-v', 'quiet', '-print_format', 'json', '-show_format', '-show_streams', filePath];

    let out = '';
    let errOut = '';

    const candidates: string[] = [];
    const bundled = (ffprobeStatic as any)?.path as string | undefined;
    if (bundled) candidates.push(bundled);
    candidates.push('ffprobe');

    let idx = 0;
    const spawnNext = () => {
      if (idx >= candidates.length) {
        resolve({ ok: false, reason: 'ffprobe_not_found', details: 'no_ffprobe_available' });
        return;
      }

      const cmd = candidates[idx++];

      out = '';
      errOut = '';

      const child = spawn(cmd, args, { windowsHide: true });

      child.stdout.on('data', (d) => (out += String(d)));
      child.stderr.on('data', (d) => (errOut += String(d)));

      child.on('error', (e: any) => {
        if (e?.code === 'ENOENT') {
          spawnNext();
          return;
        }
        resolve({ ok: false, reason: 'ffprobe_failed', details: e?.message ?? errOut });
      });

      child.on('close', (code) => {
        if (code !== 0) {
          // If system ffprobe is missing, it usually errors with ENOENT (handled above).
          // Non-zero exit means ffprobe ran but failed for this file.
          resolve({ ok: false, reason: 'ffprobe_failed', details: errOut || `exit_${code}` });
          return;
        }

        try {
          const json = JSON.parse(out);
          const md = extract(json);
          resolve({ ok: true, metadata: md, cached: false });
        } catch (e: any) {
          resolve({ ok: false, reason: 'unknown', details: e?.message ?? 'parse_failed' });
        }
      });
    };

    spawnNext();
  });
}

function extract(json: any): MediaMetadata {
  const streams = Array.isArray(json?.streams) ? json.streams : [];
  const video = streams.find((s: any) => s?.codec_type === 'video') ?? null;
  const fmt = json?.format ?? null;

  const durationSec = fmt?.duration ? Number(fmt.duration) : undefined;
  const sizeBytes = fmt?.size ? Number(fmt.size) : undefined;
  const format = fmt?.format_name ? String(fmt.format_name) : undefined;

  let fps: number | undefined;
  const fr = video?.avg_frame_rate || video?.r_frame_rate;
  if (typeof fr === 'string' && fr.includes('/')) {
    const [a, b] = fr.split('/').map((x: string) => Number(x));
    if (a && b) fps = a / b;
  }

  return {
    durationSec,
    width: video?.width ? Number(video.width) : undefined,
    height: video?.height ? Number(video.height) : undefined,
    codec: video?.codec_name ? String(video.codec_name) : undefined,
    fps,
    format,
    sizeBytes,
    raw: json,
  };
}
