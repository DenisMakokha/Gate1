import { EventEmitter } from 'events';
import { exec } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';

export type SdDriveInfo = {
  driveLetter: string; // e.g. E
  mountPath: string; // e.g. E:\\
  volumeLabel?: string;
  sizeBytes?: number;
};

export type SdCardIdentity = {
  mountPath: string;
  driveLetter: string;
  hardwareId: string; // stable-ish identifier (volume serial)
  fsUuid?: string; // reserved
  detectedAtIso: string;
};

function execText(command: string, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    exec(command, { timeout: timeoutMs, windowsHide: true }, (err, stdout, stderr) => {
      if (err) return reject(err);
      const out = (stdout || stderr || '').toString();
      resolve(out);
    });
  });
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function isLikelyCameraSdRoot(mountPath: string): Promise<boolean> {
  // Keep heuristic light and fast.
  // Camera SDs usually contain DCIM or PRIVATE.
  return (await pathExists(path.join(mountPath, 'DCIM'))) || (await pathExists(path.join(mountPath, 'PRIVATE')));
}

async function getVolumeSerial(driveLetter: string): Promise<string | null> {
  // "vol E:" output contains "Volume Serial Number is XXXX-XXXX"
  try {
    const out = await execText(`vol ${driveLetter}:`, 3000);
    const match = out.match(/Serial Number is\s+([A-F0-9-]+)/i);
    if (!match) return null;
    return match[1].replace(/-/g, '').toUpperCase();
  } catch {
    return null;
  }
}

async function listRemovableDrives(): Promise<SdDriveInfo[]> {
  // WMIC is deprecated but still common on Windows deployments; we keep a fallback.
  // DriveType=2 means removable disk.
  try {
    const out = await execText(
      'wmic logicaldisk where "DriveType=2" get DeviceID,VolumeName,Size /format:csv',
      5000
    );

    const lines = out
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(l => l && !l.toLowerCase().startsWith('node'));

    const drives: SdDriveInfo[] = [];

    for (const line of lines) {
      // CSV: Node,DeviceID,Size,VolumeName
      const parts = line.split(',');
      if (parts.length < 3) continue;

      const deviceId = (parts[1] ?? '').trim();
      if (!/^[A-Z]:$/i.test(deviceId)) continue;

      const driveLetter = deviceId[0].toUpperCase();
      const sizeRaw = (parts[2] ?? '').trim();
      const label = (parts[3] ?? '').trim();
      const sizeBytes = sizeRaw ? Number(sizeRaw) : undefined;

      drives.push({
        driveLetter,
        mountPath: `${driveLetter}:\\`,
        volumeLabel: label || undefined,
        sizeBytes: Number.isFinite(sizeBytes) ? sizeBytes : undefined,
      });
    }

    return drives;
  } catch {
    // Fallback: probe typical removable letters.
    const candidates = 'EFGHIJKLMNOP'.split('');
    const result: SdDriveInfo[] = [];
    for (const letter of candidates) {
      const mountPath = `${letter}:\\`;
      if (await pathExists(mountPath)) {
        result.push({ driveLetter: letter, mountPath });
      }
    }
    return result;
  }
}

export class SdDetectorWin extends EventEmitter {
  private timer: NodeJS.Timeout | null = null;
  private scanning = false;
  private mountedByPath = new Map<string, SdCardIdentity>();

  start(intervalMs: number = 4000) {
    if (this.timer) clearInterval(this.timer);
    void this.scanOnce();
    this.timer = setInterval(() => {
      void this.scanOnce();
    }, intervalMs);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  getMounted(): SdCardIdentity[] {
    return Array.from(this.mountedByPath.values());
  }

  private async scanOnce(): Promise<void> {
    if (this.scanning) return;
    this.scanning = true;

    try {
      const drives = await listRemovableDrives();

      // Filter to camera-like SDs
      const candidates: SdDriveInfo[] = [];
      for (const d of drives) {
        // cheap accessibility check
        if (!(await pathExists(d.mountPath))) continue;
        if (!(await isLikelyCameraSdRoot(d.mountPath))) continue;
        candidates.push(d);
      }

      const currentPaths = new Set(candidates.map(c => c.mountPath));

      // New insertions
      for (const d of candidates) {
        if (this.mountedByPath.has(d.mountPath)) continue;

        const serial = await getVolumeSerial(d.driveLetter);
        const hardwareId = serial ? `SD-${serial}` : `SD-${d.driveLetter}`;

        const identity: SdCardIdentity = {
          mountPath: d.mountPath,
          driveLetter: d.driveLetter,
          hardwareId,
          detectedAtIso: new Date().toISOString(),
        };

        this.mountedByPath.set(d.mountPath, identity);
        this.emit('sd-inserted', identity);
      }

      // Removals
      for (const [mountPath, identity] of Array.from(this.mountedByPath.entries())) {
        if (!currentPaths.has(mountPath)) {
          this.mountedByPath.delete(mountPath);
          this.emit('sd-removed', identity);
        }
      }
    } finally {
      this.scanning = false;
    }
  }
}
