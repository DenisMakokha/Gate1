import { app, BrowserWindow, ipcMain, Menu, Tray, nativeImage, type IpcMainInvokeEvent, dialog, screen } from 'electron';
import os from 'os';
import path from 'path';
import { existsSync, promises as fs } from 'fs';
import fsSync from 'fs';
import crypto from 'crypto';
import { APP_NAME } from './core/constants';
import { DEFAULT_API_URL } from './core/constants';
import { store } from './core/store';
import { getOrCreateDeviceId } from './core/deviceId';
import { ApiClient } from './core/apiClient';
import { clearToken, getToken, isTokenExpired, setToken } from './core/secureToken';
import { OfflineQueue } from './core/offlineQueue';
import { AuditLogger } from './core/auditLogger';
import { ConnectivityMonitor } from './core/connectivityMonitor';
import { SdDetectorWin, type SdCardIdentity } from './core/sdDetectorWin';
import { SdSessionEngine, type ActiveSdSession } from './core/sdSessionEngine';
import { SnapshotEngine, type SnapshotResult, type SnapshotProgress } from './core/snapshotEngine';
import { computeDeleteAtIso, decryptPolicy, encryptPolicy, type EventPolicy } from './core/policyCache';
import { ProgressReporter } from './core/progressReporter';
import { CopyObserver, type CopyCandidate } from './core/copyObserver';
import { validateFilename } from './core/filenameRules';
import { DuplicationIndex } from './core/duplicationIndex';
import { BackupEngine, type BackupFileError, type BackupProgress } from './core/backupEngine';
import { IssueEngine, type Issue } from './core/issueEngine';
import { MediaMetadataEngine } from './core/mediaMetadata';


let mainWindow: BrowserWindow | null = null;
let mascotWindow: BrowserWindow | null = null;
let messageWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let api: ApiClient;
let heartbeatTimer: NodeJS.Timeout | null = null;
let queueDrainTimer: NodeJS.Timeout | null = null;
let configRefreshTimer: NodeJS.Timeout | null = null;
let streamTunnelTimer: NodeJS.Timeout | null = null;
let isQuitting = false;

let lastAttention: { reason: string; data: any } | null = null;
let pendingBubbleReason: string | null = null;

type MascotMode = 'idle' | 'snapshot' | 'copy' | 'backup';
let mascotMode: MascotMode = 'idle';

let offlineQueue: OfflineQueue;
let audit: AuditLogger;
let connectivity: ConnectivityMonitor;
let lastQueueDrainAtIso: string | null = null;
let lastOnline: boolean | null = null;
let lastConfigRefreshAtIso: string | null = null;

const wasAutoStarted = process.argv.includes('--autostart');
let lastTrayStatusLabel: string | null = null;

type CoreUiState =
  | 'IDLE'
  | 'SD_DETECTED'
  | 'SESSION_ACTIVE'
  | 'COPYING_IN_PROGRESS'
  | 'ATTENTION_REQUIRED'
  | 'ISSUE_RECORDED'
  | 'SD_REMOVAL_CHECK'
  | 'EARLY_REMOVAL_CONFIRMED'
  | 'BACKUP_IN_PROGRESS'
  | 'SESSION_CLOSED'
  | 'RETENTION_PENDING';

let uiState: CoreUiState = 'IDLE';
let uiStatePrev: CoreUiState = 'IDLE';
let uiStateCtx: any = null;
let uiStateAutoRevertTimer: NodeJS.Timeout | null = null;
let sdDetectedAtMs: number | null = null;
let lastCopyBubbleAtMs = 0;
let lastBackupBubbleAtMs = 0;
let lastSnapshotBubbleAtMs = 0;
let lastRetentionBubbleAtMs = 0;
let lastNotifiedCriticalIssueId: string | null = null;
let lastBackupSummaryBySessionId: Record<string, { completedFiles: number; totalFiles: number; failedFiles: number } | undefined> = {};

let lastBackupReadyKey: string | null = null;
let lastBackupReadyBubbleAtMs = 0;
let lastIssuePromptAtMs = 0;
let lastIssuePromptKey: string | null = null;

let lastAuthOk = false;
let lastMascotNet: boolean | null = null;
let lastMascotLive = false;
let lastNetBubbleAtMs = 0;

type BackupHashScanCache = {
  key: string;
  computedAtMs: number;
  // quickHash -> { count, examplePath }
  map: Map<string, { count: number; examplePath: string }>;
};

async function detectBackupDiskReady(): Promise<void> {
  // Only meaningful during an active session.
  const active = sdSessionEngine?.getActive?.() ?? null;
  if (!active || active.status !== 'active') {
    lastBackupReadyKey = null;
    return;
  }

  const cfg = store.get('config');
  const candidates: string[] = [];

  const last = store.get('lastBackupSummary') as any;
  const lastDest = last?.destRoot ? String(last.destRoot) : null;
  if (lastDest) candidates.push(lastDest);
  if (cfg?.backupDestination) candidates.push(String(cfg.backupDestination));
  if (Array.isArray(cfg?.backupDestinations)) candidates.push(...cfg.backupDestinations.map(String));

  const uniq = Array.from(new Set(candidates.filter((s) => typeof s === 'string' && s.trim().length > 0)));
  if (uniq.length === 0) {
    lastBackupReadyKey = null;
    return;
  }

  for (const p of uniq) {
    const info = await checkWritableDir(p);
    if (info.exists && info.writable) {
      const key = `${active.sessionId}:${p}`;
      // Bubble only when it becomes ready (or changes disk)
      if (lastBackupReadyKey !== key) {
        lastBackupReadyKey = key;
        uiStateCtx = { ...(uiStateCtx ?? {}), backupReady: true, recommendedBackupRoot: p, recommendedBackupDisk: deriveDiskLabel(p) };
        emitUiState();

        const nowMs = Date.now();
        if (nowMs - lastBackupReadyBubbleAtMs > 10_000) {
          lastBackupReadyBubbleAtMs = nowMs;
          showMessageBubble('Backup disk ready.', `Disk: ${deriveDiskLabel(p)} • Click to open`, 3500);
        }
      }
      return;
    }
  }

  // No disks ready
  lastBackupReadyKey = null;
  uiStateCtx = { ...(uiStateCtx ?? {}), backupReady: false, recommendedBackupRoot: null, recommendedBackupDisk: null };
  emitUiState();
}

let backupHashScanCache: BackupHashScanCache | null = null;

async function computeQuickHash(filePath: string, fileSize: number): Promise<string> {
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

async function refreshActiveEventSummary(): Promise<void> {
  const tokenData = await getToken();
  if (!tokenData || isTokenExpired(tokenData.expiryIso)) return;

  const ping = connectivity.getSnapshot();
  if (!ping.online) return;

  try {
    const activeEvent = await api.getActiveEvent();
    store.set('activeEventId', activeEvent?.id ?? null);
    store.set('activeEventName', activeEvent?.name ?? null);
    store.set('activeEventFetchedAtIso', new Date().toISOString());
  } catch {
    store.set('activeEventId', null);
    store.set('activeEventName', null);
    store.set('activeEventFetchedAtIso', new Date().toISOString());
  }
}

async function scanBackupQuickHashes(params: { destSessionDir: string; cacheKey: string }): Promise<Map<string, { count: number; examplePath: string }>> {
  const nowMs = Date.now();
  if (backupHashScanCache && backupHashScanCache.key === params.cacheKey && nowMs - backupHashScanCache.computedAtMs < 10_000) {
    return backupHashScanCache.map;
  }

  const map = new Map<string, { count: number; examplePath: string }>();
  const videoExts = new Set(['.mp4', '.mov', '.avi', '.mkv', '.mts', '.m2ts']);
  const maxDepth = 8;

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
      try {
        const qh = await computeQuickHash(full, st.size);
        const existing = map.get(qh);
        if (existing) {
          existing.count += 1;
        } else {
          map.set(qh, { count: 1, examplePath: full });
        }
      } catch {
        // ignore hash failures
      }
    }
  };

  await walk(params.destSessionDir, 0);

  backupHashScanCache = { key: params.cacheKey, computedAtMs: nowMs, map };
  return map;
}

type LastBackupSummary = {
  atIso: string;
  sessionId: string;
  destRoot: string;
  diskLabel: string;
  completedFiles: number;
  totalFiles: number;
  failedFiles: number;
  copiedBytes: number;
  totalBytes: number;
};

function deriveDiskLabel(destRoot: string): string {
  try {
    const norm = String(destRoot || '');
    // Windows: D:\... -> D:
    const m = norm.match(/^([A-Za-z]:)\\/);
    if (m) return m[1].toUpperCase();
    // macOS: /Volumes/DISK/... -> DISK
    const mm = norm.match(/^\/Volumes\/([^\/]+)/);
    if (mm) return mm[1];
    // fallback: folder name
    const base = path.basename(norm);
    return base || norm || 'Unknown';
  } catch {
    return 'Unknown';
  }
}

function formatEat(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const dtf = new Intl.DateTimeFormat('en-KE', {
      timeZone: 'Africa/Nairobi',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    return `${dtf.format(d)} EAT`;
  } catch {
    return iso;
  }
}

function emitUiState(): void {
  mainWindow?.webContents?.send('ui:state', { state: uiState, context: uiStateCtx ?? null });
}

function setUiStateAfter(ms: number, next: CoreUiState, ctx?: any): void {
  setTimeout(() => {
    setUiState(next, ctx);
  }, ms);
}

function setMascotState(state: CoreUiState): void {
  if (!mascotWindow) return;
  void mascotWindow.webContents.executeJavaScript(
    `try { document.documentElement.dataset.state = ${JSON.stringify(state)}; } catch {}`,
    true
  );
}

function setMascotLoopPulse(kind: 'none' | 'copying' | 'backup'): void {
  if (!mascotWindow) return;
  void mascotWindow.webContents.executeJavaScript(
    `try { document.documentElement.dataset.loop = ${JSON.stringify(kind === 'none' ? '' : kind)}; } catch {}`,
    true
  );
}

function setUiState(next: CoreUiState, ctx?: any, opts?: { bubbleTitle?: string; bubbleSub?: string; bubbleMs?: number; autoOpenWindow?: boolean; revertToPrevMs?: number }) {
  if (uiStateAutoRevertTimer) {
    clearTimeout(uiStateAutoRevertTimer);
    uiStateAutoRevertTimer = null;
  }

  uiStatePrev = uiState;
  uiState = next;
  uiStateCtx = ctx ?? uiStateCtx;

  setMascotState(uiState);

  if (uiState === 'ATTENTION_REQUIRED' || uiState === 'EARLY_REMOVAL_CONFIRMED') {
    setMascotAttention(true);
    setMascotLoopPulse('none');
  } else {
    setMascotAttention(false);
  }

  if (uiState === 'COPYING_IN_PROGRESS') setMascotLoopPulse('copying');
  else if (uiState === 'BACKUP_IN_PROGRESS') setMascotLoopPulse('backup');
  else setMascotLoopPulse('none');

  if (opts?.bubbleTitle || opts?.bubbleSub) {
    showMessageBubble(opts?.bubbleTitle ?? '', opts?.bubbleSub ?? '', opts?.bubbleMs ?? null);
  }

  if (opts?.autoOpenWindow) {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  }

  emitUiState();

  if (opts?.revertToPrevMs != null) {
    const ms = opts.revertToPrevMs;
    uiStateAutoRevertTimer = setTimeout(() => {
      uiStateAutoRevertTimer = null;
      const target = uiStatePrev;
      uiState = target;
      setMascotState(uiState);
      setMascotAttention(false);
      setMascotLoopPulse('none');
      emitUiState();
    }, ms);
  }
}

async function sendCriticalIssueToServer(issue: Issue): Promise<'sent' | 'queued_offline' | 'queued_retry' | 'skipped'> {
  if (issue.severity !== 'error') return 'skipped';
  const deviceId = getOrCreateDeviceId();
  const active = sdSessionEngine?.getActive?.() ?? null;
  const ping = connectivity.getSnapshot();

  const serverPayload = {
    device_id: deviceId,
    issue_id: issue.id,
    severity: issue.severity,
    code: issue.code,
    message: issue.message,
    data: issue.data ?? null,
    created_at_iso: issue.createdAtIso,
    server_session_id: active?.serverSessionId ?? null,
    event_id: active?.eventId ?? null,
  };

  const endpoint = '/issues/report';

  if (!ping.online) {
    offlineQueue.enqueue({ endpoint, method: 'POST', payload: serverPayload });
    audit.warn('issues.critical_queued_offline', { issueId: issue.id });
    return 'queued_offline';
  }

  try {
    await api.reportIssue(serverPayload);
    audit.info('issues.critical_sent', { issueId: issue.id });
    return 'sent';
  } catch (e: any) {
    offlineQueue.enqueue({ endpoint, method: 'POST', payload: serverPayload });
    audit.warn('issues.critical_failed_queued', { issueId: issue.id, reason: e?.message ?? 'unknown' });
    return 'queued_retry';
  }
}

async function checkWritableDir(dirPath: string): Promise<{ exists: boolean; writable: boolean; reason?: string }> {
  try {
    const st = await fs.stat(dirPath);
    if (!st.isDirectory()) return { exists: true, writable: false, reason: 'not_a_directory' };
  } catch {
    return { exists: false, writable: false, reason: 'not_found' };
  }

  // Try write/delete a small temp file
  const tmp = path.join(dirPath, `.gate1_write_test_${Date.now()}_${Math.random().toString(16).slice(2)}.tmp`);
  try {
    await fs.writeFile(tmp, 'ok', 'utf8');
    await fs.unlink(tmp);
    return { exists: true, writable: true };
  } catch {
    try {
      await fs.unlink(tmp);
    } catch {
      // ignore
    }
    return { exists: true, writable: false, reason: 'not_writable' };
  }
}

let sdDetector: SdDetectorWin | null = null;
let sdSessionEngine: SdSessionEngine | null = null;
let snapshotEngine: SnapshotEngine | null = null;

let cachedEventPolicy: EventPolicy | null = null;
let progressReporter: ProgressReporter | null = null;
let copyObserver: CopyObserver | null = null;
let warnedRenameFiles: Set<string> = new Set();

type CopyState = {
  sessionId: string;
  pendingByKey: Map<string, { name: string; sizeBytes: number }>;
  hashByKey: Map<string, string>;
  copiedKeys: Set<string>;
};

type MediaBatchItem = {
  filename: string;
  original_path: string;
  type: 'before' | 'after';
  size_bytes: number;
  checksum?: string | null;
  created_at?: string | null;
  parsed_metadata?: { full_name?: string; age?: number; condition?: string; region?: string };
};

function inferMediaTypeFromFilename(filename: string): 'before' | 'after' {
  const n = filename.toLowerCase();
  if (n.includes('after')) return 'after';
  return 'before';
}

function parseFilenameMetadata(filename: string): { full_name?: string; age?: number; condition?: string; region?: string } {
  const base = path.basename(filename, path.extname(filename));
  const parts = base.split('_').filter(Boolean);

  // Expected: FULLNAME_AGE_CONDITION_REGION (per agent config)
  if (parts.length < 4) return {};

  const [fullName, ageRaw, condition, region] = parts;
  const age = Number(ageRaw);

  return {
    full_name: fullName ? String(fullName) : undefined,
    age: Number.isFinite(age) ? age : undefined,
    condition: condition ? String(condition) : undefined,
    region: region ? String(region) : undefined,
  };
}

async function trySyncMediaOnCopy(params: {
  sessionId: string;
  filename: string;
  fullPath: string;
  sizeBytes: number;
  quickHash?: string | null;
  createdAtIso?: string | null;
}): Promise<void> {
  // deprecated (kept for compatibility): this now queues into the batcher
  await queueMediaForBatch({
    filename: params.filename,
    fullPath: params.fullPath,
    sizeBytes: params.sizeBytes,
    checksum: params.quickHash ?? null,
    createdAtIso: params.createdAtIso ?? null,
  });
}

let mediaBatchTimer: NodeJS.Timeout | null = null;
let mediaBatch: MediaBatchItem[] = [];
let mediaBatchCtx: {
  agentId: string;
  deviceId: string;
  eventId: number;
  camera_number: number | null;
  sd_card_id: number | null;
} | null = null;

function clearMediaBatchTimer(): void {
  if (mediaBatchTimer) {
    clearTimeout(mediaBatchTimer);
    mediaBatchTimer = null;
  }
}

async function flushMediaBatch(reason: 'timer' | 'full' | 'session_end' | 'shutdown'): Promise<void> {
  clearMediaBatchTimer();
  if (!mediaBatch.length || !mediaBatchCtx) return;

  const tokenData = await getToken();
  if (!tokenData || isTokenExpired(tokenData.expiryIso)) return;

  const ping = connectivity.getSnapshot();
  const payload = {
    agent_id: mediaBatchCtx.agentId,
    device_id: mediaBatchCtx.deviceId,
    event_id: mediaBatchCtx.eventId,
    camera_number: mediaBatchCtx.camera_number,
    sd_card_id: mediaBatchCtx.sd_card_id,
    files: mediaBatch,
  };

  const batchSize = mediaBatch.length;
  mediaBatch = [];

  if (!ping.online) {
    offlineQueue.enqueue({ endpoint: '/media/batch-sync', method: 'POST', payload });
    audit.info('media.batch_sync_queued_offline', { reason, batchSize, eventId: mediaBatchCtx.eventId });
    return;
  }

  try {
    await api.request({ method: 'POST', url: '/media/batch-sync', data: payload, timeoutMs: 30000 });
    audit.info('media.batch_sync_sent', { reason, batchSize, eventId: mediaBatchCtx.eventId });
  } catch (e: any) {
    offlineQueue.enqueue({ endpoint: '/media/batch-sync', method: 'POST', payload });
    audit.warn('media.batch_sync_failed_queued', {
      reason,
      batchSize,
      eventId: mediaBatchCtx.eventId,
      err: e?.message ?? 'unknown',
    });
  }
}

async function queueMediaForBatch(params: {
  filename: string;
  fullPath: string;
  sizeBytes: number;
  checksum?: string | null;
  createdAtIso?: string | null;
}): Promise<void> {
  const agentId = store.get('agentId');
  const tokenData = await getToken();
  if (!agentId || !tokenData || isTokenExpired(tokenData.expiryIso)) return;

  const active = sdSessionEngine?.getActive();
  if (!active || active.status !== 'active') return;

  const eventId = active.eventId ?? store.get('activeEventId') ?? store.get('lastKnownActiveEventId') ?? null;
  if (!eventId) return;

  const deviceId = getOrCreateDeviceId();

  // Reset batch context if event/binding changed
  const ctxKey = `${agentId}:${deviceId}:${eventId}:${active.binding?.cameraNumber ?? 'n'}:${active.binding?.sdCardId ?? 'n'}`;
  const prevKey = mediaBatchCtx
    ? `${mediaBatchCtx.agentId}:${mediaBatchCtx.deviceId}:${mediaBatchCtx.eventId}:${mediaBatchCtx.camera_number ?? 'n'}:${mediaBatchCtx.sd_card_id ?? 'n'}`
    : null;
  if (prevKey && prevKey !== ctxKey) {
    await flushMediaBatch('session_end');
  }

  mediaBatchCtx = {
    agentId,
    deviceId,
    eventId: Number(eventId),
    camera_number: active.binding?.cameraNumber ?? null,
    sd_card_id: active.binding?.sdCardId ?? null,
  };

  const item: MediaBatchItem = {
    filename: params.filename,
    original_path: params.fullPath,
    type: inferMediaTypeFromFilename(params.filename),
    size_bytes: params.sizeBytes,
    checksum: params.checksum ?? null,
    created_at: params.createdAtIso ?? null,
    parsed_metadata: parseFilenameMetadata(params.filename),
  };

  mediaBatch.push(item);

  const maxBatch = 20;
  const flushDelayMs = 2000;

  if (mediaBatch.length >= maxBatch) {
    await flushMediaBatch('full');
    return;
  }

  if (!mediaBatchTimer) {
    mediaBatchTimer = setTimeout(() => {
      void flushMediaBatch('timer');
    }, flushDelayMs);
  }
}

let copyState: CopyState | null = null;
let warnedDestinations: Set<string> = new Set();
let warnedDuplicates: Set<string> = new Set();
let dupIndex: DuplicationIndex | null = null;
let backupEngine: BackupEngine | null = null;
let issueEngine: IssueEngine | null = null;
let mediaMetadata: MediaMetadataEngine | null = null;

type RemovalPending = {
  serverSessionId: string;
  filesCopied: number;
  filesPending: number;
};

let removalPending: RemovalPending | null = null;

function makeFileKey(name: string, sizeBytes: number): string {
  return `${name}|${sizeBytes}`;
}

function getCopyCounts(): { filesCopied: number; filesPending: number } {
  if (!copyState) return { filesCopied: 0, filesPending: 0 };
  const filesCopied = copyState.copiedKeys.size;
  const filesPending = Math.max(0, copyState.pendingByKey.size - filesCopied);
  return { filesCopied, filesPending };
}

async function endServerSession(params: {
  serverSessionId: string;
  removalDecision: 'safe' | 'early_confirmed';
  filesCopied: number;
  filesPending: number;
}): Promise<'sent' | 'queued' | 'skipped'> {
  const ping = connectivity.getSnapshot();

  const endpoint = `/session/${params.serverSessionId}/end`;
  const payload = {
    sessionId: params.serverSessionId,
    removal_decision: params.removalDecision,
    files_copied: params.filesCopied,
    files_pending: params.filesPending,
  };

  if (!ping.online) {
    offlineQueue.enqueue({ endpoint, method: 'POST', payload });
    return 'queued';
  }

  try {
    await api.endSession(payload);
    return 'sent';
  } catch {
    offlineQueue.enqueue({ endpoint, method: 'POST', payload });
    return 'queued';
  }
}

function handleRenameGuidance(evt: any) {
  const newName: string = evt?.newName;
  const oldName: string = evt?.oldName;
  const newPath: string = evt?.newPath;
  if (!newName || !newPath) return;

  // Editor-first prompt: when a clip is renamed (often right before reviewing), ask if they want to report an issue.
  // Throttle to avoid nagging.
  const nowMs = Date.now();
  const promptKey = String(newPath);
  if (nowMs - lastIssuePromptAtMs > 30_000 && lastIssuePromptKey !== promptKey) {
    lastIssuePromptAtMs = nowMs;
    lastIssuePromptKey = promptKey;

    uiStateCtx = {
      ...(uiStateCtx ?? {}),
      issuePrompt: {
        clipName: newName,
        clipPath: newPath,
        oldName: oldName ?? null,
        atIso: new Date().toISOString(),
      },
    };
    emitUiState();

    showMessageBubble('Issue with this clip?', String(newName), 4500);

    // Auto-clear after a short window so it doesn't stick forever.
    setTimeout(() => {
      try {
        if (uiStateCtx?.issuePrompt?.clipPath === newPath) {
          uiStateCtx = { ...(uiStateCtx ?? {}), issuePrompt: null };
          emitUiState();
        }
      } catch {
        // ignore
      }
    }, 60_000);
  }

  // avoid spamming for the same file name/path
  const key = `${newPath}`;
  if (warnedRenameFiles.has(key)) return;

  const result = validateFilename(newName);
  if (result.status === 'ok') return;

  warnedRenameFiles.add(key);

  if (result.status === 'major') {
    emitAttentionRequired('FILENAME_MAJOR', {
      oldName,
      newName,
      issues: result.issues,
    });
    audit.warn('rename.guidance_major', { oldName, newName, issues: result.issues });
  } else {
    mainWindow?.webContents?.send('rename:tip', {
      oldName,
      newName,
      issues: result.issues,
    });
    audit.info('rename.guidance_minor', { oldName, newName, issues: result.issues });
  }
}

function isPathInside(child: string, parent: string): boolean {
  const rel = path.relative(parent, child);
  return !!rel && !rel.startsWith('..') && !path.isAbsolute(rel);
}

function isAllowedStreamPath(filePath: string): boolean {
  const cfg = store.get('config');
  const watched = Array.isArray(cfg?.watchedFolders) ? (cfg?.watchedFolders as string[]) : [];
  const backupDestination = typeof cfg?.backupDestination === 'string' ? (cfg?.backupDestination as string) : null;
  const backupDestinations = Array.isArray(cfg?.backupDestinations) ? (cfg?.backupDestinations as string[]) : [];

  const roots = [...watched, ...(backupDestination ? [backupDestination] : []), ...backupDestinations]
    .filter(Boolean)
    .map((p) => path.resolve(String(p)));

  const resolved = path.resolve(String(filePath));
  return roots.some((r) => resolved === r || isPathInside(resolved, r));
}

async function pollStreamJobsOnce(): Promise<void> {
  const agentId = store.get('agentId');
  const tokenData = await getToken();
  if (!agentId || !tokenData || isTokenExpired(tokenData.expiryIso)) return;

  const ping = connectivity.getSnapshot();
  if (!ping.online) return;

  try {
    const deviceId = getOrCreateDeviceId();
    const res: any = await api.request({
      method: 'POST',
      url: '/agent/stream/poll',
      data: { agent_id: agentId, device_id: deviceId },
      timeoutMs: 20000,
    });

    const job = res?.job ?? null;
    if (!job) return;

    const jobId: string | undefined = job?.job_id;
    const filePath: string | undefined = job?.file_path;
    const start: number = Number(job?.start ?? 0);
    const end: number = Number(job?.end ?? -1);

    if (!jobId || !filePath || !Number.isFinite(start) || !Number.isFinite(end)) {
      await api.request({
        method: 'POST',
        url: '/agent/stream/respond',
        data: { job_id: jobId ?? 'unknown', status: 400, error: 'invalid_job' },
        timeoutMs: 20000,
      });
      return;
    }

    if (end < start) {
      await api.request({
        method: 'POST',
        url: '/agent/stream/respond',
        data: { job_id: jobId, status: 416, error: 'invalid_range' },
        timeoutMs: 20000,
      });
      return;
    }

    if (!isAllowedStreamPath(filePath)) {
      await api.request({
        method: 'POST',
        url: '/agent/stream/respond',
        data: { job_id: jobId, status: 403, error: 'path_not_allowed' },
        timeoutMs: 20000,
      });
      return;
    }

    let st;
    try {
      st = await fs.stat(filePath);
    } catch {
      await api.request({
        method: 'POST',
        url: '/agent/stream/respond',
        data: { job_id: jobId, status: 404, error: 'file_not_found' },
        timeoutMs: 20000,
      });
      return;
    }

    const size = st.size;
    if (size <= 0) {
      await api.request({
        method: 'POST',
        url: '/agent/stream/respond',
        data: { job_id: jobId, status: 404, error: 'empty_file' },
        timeoutMs: 20000,
      });
      return;
    }

    const safeStart = Math.max(0, Math.min(start, Math.max(0, size - 1)));
    const safeEnd = Math.max(safeStart, Math.min(end, Math.max(0, size - 1)));
    const maxChunk = 2 * 1024 * 1024;
    const boundedEnd = Math.min(safeEnd, safeStart + maxChunk - 1);
    const length = boundedEnd - safeStart + 1;

    const ext = path.extname(filePath).toLowerCase();
    const contentType = ext === '.mp4' ? 'video/mp4' : ext === '.mov' ? 'video/quicktime' : 'application/octet-stream';

    const fh = await fs.open(filePath, 'r');
    try {
      const buf = Buffer.alloc(length);
      const { bytesRead } = await fh.read(buf, 0, length, safeStart);
      const out = buf.subarray(0, bytesRead);

      const statusCode = safeStart === 0 && boundedEnd >= size - 1 ? 200 : 206;
      await api.request({
        method: 'POST',
        url: '/agent/stream/respond',
        data: {
          job_id: jobId,
          status: statusCode,
          headers: {
            'Content-Type': contentType,
            'Accept-Ranges': 'bytes',
            ...(statusCode === 206 ? { 'Content-Range': `bytes ${safeStart}-${safeStart + bytesRead - 1}/${size}` } : {}),
            'Content-Length': String(bytesRead),
          },
          data_base64: out.toString('base64'),
        },
        timeoutMs: 20000,
      });
    } finally {
      await fh.close();
    }
  } catch {
    // non-blocking
  }
}

function startStreamTunnelLoop(): void {
  if (streamTunnelTimer) clearInterval(streamTunnelTimer);
  streamTunnelTimer = setInterval(() => {
    void pollStreamJobsOnce();
  }, 900);
}

function isUnsafeDestination(destDir: string): { unsafe: boolean; reason?: string } {
  const lower = destDir.toLowerCase();

  // High-risk default Windows paths.
  const unsafeMarkers = [
    `${path.sep}desktop${path.sep}`,
    `${path.sep}downloads${path.sep}`,
    `${path.sep}temp${path.sep}`,
    `${path.sep}appdata${path.sep}`,
    `${path.sep}$recycle.bin${path.sep}`,
  ];

  if (unsafeMarkers.some(m => lower.includes(m))) {
    return { unsafe: true, reason: 'UNSAFE_SYSTEM_FOLDER' };
  }

  // Root directories (e.g. C:\, D:\) are risky.
  const parsed = path.parse(destDir);
  if (parsed.root && parsed.root.toLowerCase() === destDir.toLowerCase()) {
    return { unsafe: true, reason: 'ROOT_DIRECTORY' };
  }

  return { unsafe: false };
}

function isInWatchedFolders(fullPath: string): boolean {
  const folders = store.get('config')?.watchedFolders ?? [];
  return folders.some(f => {
    try {
      return isPathInside(fullPath, f);
    } catch {
      return false;
    }
  });
}

function toggleMainWindow(): void {
  if (!mainWindow) return;
  if (mainWindow.isVisible()) {
    mainWindow.hide();
  } else {
    mainWindow.show();
    mainWindow.focus();
  }
}

function showAttentionInWindow(): void {
  if (!lastAttention) return;
  if (!mainWindow) return;
  mainWindow.show();
  mainWindow.focus();
  mainWindow.webContents.send('attention:required', {
    reason: lastAttention.reason,
    data: lastAttention.data ?? null,
  });
}

function emitAttentionRequired(reason: string, data: any): void {
  lastAttention = { reason, data: data ?? null };
  mainWindow?.webContents?.send('attention:required', { reason, data: data ?? null });
  setUiState('ATTENTION_REQUIRED', { reason, data: data ?? null }, { bubbleTitle: 'Attention needed.', bubbleSub: 'Please review.', autoOpenWindow: true });
}

function clearAttentionState(): void {
  lastAttention = null;
  hideMessageBubble();
  if (uiState === 'ATTENTION_REQUIRED') {
    const active = sdSessionEngine?.getActive?.() ?? null;
    setUiState(active && active.status === 'active' ? 'SESSION_ACTIVE' : 'IDLE', { activeSession: active });
  }
}

function setMascotAttention(active: boolean): void {
  if (!mascotWindow) return;
  void mascotWindow.webContents.executeJavaScript(
    `try {
      document.documentElement.dataset.attn = ${active ? `'1'` : `''`};
      const m = document.getElementById('m');
      const src = ${active ? 'window.__mascot?.attn' : 'window.__mascot?.normal'};
      if (m && src) m.src = src;
    } catch {}`,
    true
  );
}

function setMascotMode(mode: MascotMode): void {
  mascotMode = mode;
  if (!mascotWindow) return;
  void mascotWindow.webContents.executeJavaScript(
    `try { document.documentElement.dataset.mode = ${JSON.stringify(mode === 'idle' ? '' : mode)}; } catch {}`,
    true
  );
}

function pulseMascot(kind: 'copy' | 'heartbeat' | 'sd' | 'binding' | 'issues'): void {
  if (!mascotWindow) return;
  void mascotWindow.webContents.executeJavaScript(
    `try {
      const k = ${JSON.stringify(kind)};
      document.documentElement.dataset.pulse = k;
      setTimeout(() => { try { if (document.documentElement.dataset.pulse === k) document.documentElement.dataset.pulse=''; } catch {} }, 420);
    } catch {}`,
    true
  );
}

function setMascotOnlineState(online: boolean | null): void {
  if (!mascotWindow) return;
  const v = online === null ? '' : online ? 'online' : 'offline';
  void mascotWindow.webContents.executeJavaScript(
    `try { document.documentElement.dataset.net = ${JSON.stringify(v)}; } catch {}`,
    true
  );
}

function setMascotLiveState(live: boolean): void {
  if (!mascotWindow) return;
  void mascotWindow.webContents.executeJavaScript(
    `try { document.documentElement.dataset.live = ${live ? `'1'` : `''`}; } catch {}`,
    true
  );
}

function updateMascotConnectivity(): void {
  const ping = connectivity?.getSnapshot?.();
  const online = ping ? !!ping.online : null;
  setMascotOnlineState(online);

  const active = sdSessionEngine?.getActive?.() ?? null;
  const live = !!(online && lastAuthOk && active && active.status === 'active' && active.serverSessionId);
  setMascotLiveState(live);

  // Transition bubbles (throttled)
  const nowMs = Date.now();
  if (online !== null && lastMascotNet !== null && online !== lastMascotNet && nowMs - lastNetBubbleAtMs > 12_000) {
    lastNetBubbleAtMs = nowMs;
    if (!online) {
      showMessageBubble('Offline.', 'Saving locally until internet returns.', 4200);
    } else {
      showMessageBubble('Back online.', 'Syncing now.', 3500);
    }
  }
  lastMascotNet = online;
  lastMascotLive = live;
}

function ensureMascotWindow(): void {
  const force = process.env.FORCE_FLOATING_MASCOT === '1';
  if (process.platform !== 'win32' && !force) return;
  if (mascotWindow) return;

  const size = 96;
  mascotWindow = new BrowserWindow({
    width: size,
    height: size,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    show: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  const mascotSvgNormal = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="g1" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#111827"/>
      <stop offset="1" stop-color="#4f46e5"/>
    </linearGradient>
    <linearGradient id="g2" x1="0" y1="1" x2="1" y2="0">
      <stop offset="0" stop-color="#a5b4fc"/>
      <stop offset="1" stop-color="#60a5fa"/>
    </linearGradient>
  </defs>
  <path d="M140 210c0-64 52-116 116-116s116 52 116 116v86c0 64-52 116-116 116s-116-52-116-116v-86z" fill="url(#g1)"/>
  <circle cx="212" cy="240" r="22" fill="#ffffff"/>
  <circle cx="300" cy="240" r="22" fill="#ffffff"/>
  <circle cx="212" cy="240" r="10" fill="#111827"/>
  <circle cx="300" cy="240" r="10" fill="#111827"/>
  <path d="M206 304c18 18 42 28 70 28 28 0 52-10 70-28" fill="none" stroke="#ffffff" stroke-width="14" stroke-linecap="round"/>
  <path d="M154 196c10-28 28-48 54-60" fill="none" stroke="url(#g2)" stroke-width="14" stroke-linecap="round"/>
  <path d="M358 196c-10-28-28-48-54-60" fill="none" stroke="url(#g2)" stroke-width="14" stroke-linecap="round"/>
</svg>`;

  const mascotSvgAttn = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="g1" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#7c2d12"/>
      <stop offset="1" stop-color="#f97316"/>
    </linearGradient>
    <linearGradient id="g2" x1="0" y1="1" x2="1" y2="0">
      <stop offset="0" stop-color="#fdba74"/>
      <stop offset="1" stop-color="#fb7185"/>
    </linearGradient>
  </defs>
  <path d="M140 210c0-64 52-116 116-116s116 52 116 116v86c0 64-52 116-116 116s-116-52-116-116v-86z" fill="url(#g1)"/>
  <circle cx="212" cy="240" r="22" fill="#ffffff"/>
  <circle cx="300" cy="240" r="22" fill="#ffffff"/>
  <circle cx="212" cy="240" r="10" fill="#111827"/>
  <circle cx="300" cy="240" r="10" fill="#111827"/>
  <path d="M206 304c18 18 42 28 70 28 28 0 52-10 70-28" fill="none" stroke="#ffffff" stroke-width="14" stroke-linecap="round"/>
  <path d="M154 196c10-28 28-48 54-60" fill="none" stroke="url(#g2)" stroke-width="14" stroke-linecap="round"/>
  <path d="M358 196c-10-28-28-48-54-60" fill="none" stroke="url(#g2)" stroke-width="14" stroke-linecap="round"/>
</svg>`;

  const svgDataUrlNormal = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(mascotSvgNormal)}`;
  const svgDataUrlAttn = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(mascotSvgAttn)}`;
  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <script>
      window.__mascot = { normal: ${JSON.stringify(svgDataUrlNormal)}, attn: ${JSON.stringify(svgDataUrlAttn)} };
    </script>
    <style>
      html, body { width: 100%; height: 100%; margin: 0; background: transparent; }
      .wrap { width: 100%; height: 100%; display: grid; place-items: center; cursor: pointer; }
      img { width: 88px; height: 88px; filter: drop-shadow(0 10px 14px rgba(0,0,0,0.25)); user-select: none; -webkit-user-drag: none; }

      /* idle float */
      @keyframes floaty { 0% { transform: translateY(0px); } 50% { transform: translateY(-3px); } 100% { transform: translateY(0px); } }
      #m { animation: floaty 2.6s ease-in-out infinite; }

      /* Connectivity color rule:
         - blue default
         - green when live + online
         - red when offline
      */
      html[data-net="offline"] #m { filter: drop-shadow(0 0 16px rgba(239,68,68,0.95)) drop-shadow(0 10px 14px rgba(0,0,0,0.22)); }
      html[data-net="online"][data-live="1"] #m { filter: drop-shadow(0 0 16px rgba(34,197,94,0.95)) drop-shadow(0 10px 14px rgba(0,0,0,0.22)); }
      html[data-net="online"]:not([data-live="1"]) #m { filter: drop-shadow(0 0 14px rgba(59,130,246,0.85)) drop-shadow(0 10px 14px rgba(0,0,0,0.22)); }

      /* authoritative state tints (suppressed by attention which swaps src and adds its own glow) */
      html:not([data-attn="1"]):not([data-net="offline"]):not([data-live="1"])[data-state="IDLE"] #m { filter: drop-shadow(0 10px 14px rgba(0,0,0,0.25)) saturate(0.95); }
      html:not([data-attn="1"]):not([data-net="offline"]):not([data-live="1"])[data-state="SD_DETECTED"] #m { filter: drop-shadow(0 0 14px rgba(59,130,246,0.85)) drop-shadow(0 10px 14px rgba(0,0,0,0.22)); }
      html:not([data-attn="1"]):not([data-net="offline"]):not([data-live="1"])[data-state="SESSION_ACTIVE"] #m { filter: drop-shadow(0 0 12px rgba(59,130,246,0.75)) drop-shadow(0 10px 14px rgba(0,0,0,0.22)); }
      html:not([data-attn="1"]):not([data-net="offline"]):not([data-live="1"])[data-state="COPYING_IN_PROGRESS"] #m { filter: drop-shadow(0 0 14px rgba(245,158,11,0.85)) drop-shadow(0 10px 14px rgba(0,0,0,0.22)); }
      html:not([data-attn="1"]):not([data-net="offline"]):not([data-live="1"])[data-state="BACKUP_IN_PROGRESS"] #m { filter: drop-shadow(0 0 14px rgba(168,85,247,0.85)) drop-shadow(0 10px 14px rgba(0,0,0,0.22)); }
      html:not([data-attn="1"]):not([data-net="offline"]):not([data-live="1"])[data-state="SD_REMOVAL_CHECK"] #m { filter: drop-shadow(0 0 14px rgba(249,115,22,0.85)) drop-shadow(0 10px 14px rgba(0,0,0,0.22)); }
      html:not([data-attn="1"]):not([data-net="offline"]):not([data-live="1"])[data-state="EARLY_REMOVAL_CONFIRMED"] #m { filter: drop-shadow(0 0 16px rgba(239,68,68,0.9)) drop-shadow(0 10px 16px rgba(0,0,0,0.25)); }
      html:not([data-attn="1"]):not([data-net="offline"]):not([data-live="1"])[data-state="SESSION_CLOSED"] #m { filter: drop-shadow(0 0 14px rgba(34,197,94,0.85)) drop-shadow(0 10px 14px rgba(0,0,0,0.22)); }
      html:not([data-attn="1"]):not([data-net="offline"]):not([data-live="1"])[data-state="RETENTION_PENDING"] #m { filter: drop-shadow(0 0 14px rgba(234,179,8,0.85)) drop-shadow(0 10px 14px rgba(0,0,0,0.22)); }

      /* quick pulses */
      @keyframes pop { 0% { transform: scale(1); } 35% { transform: scale(1.06); } 100% { transform: scale(1); } }
      html[data-pulse="copy"] #m { animation: pop 0.42s ease-out 1; }
      html[data-pulse="heartbeat"] #m { animation: pop 0.42s ease-out 1; }
      html[data-pulse="sd"] #m { animation: pop 0.42s ease-out 1; }
      html[data-pulse="binding"] #m { animation: pop 0.42s ease-out 1; }
      html[data-pulse="issues"] #m { animation: pop 0.42s ease-out 1; }

      /* slow loop pulses for ongoing work */
      @keyframes slowPulse { 0% { transform: scale(1); } 50% { transform: scale(1.03); } 100% { transform: scale(1); } }
      html[data-loop="copying"] #m { animation: slowPulse 1.25s ease-in-out infinite; }
      html[data-loop="backup"] #m { animation: slowPulse 1.6s ease-in-out infinite; }

      /* attention wiggle + glow */
      @keyframes wiggle { 0% { transform: translateY(0px) rotate(0deg); } 25% { transform: translateY(-2px) rotate(-2deg); } 50% { transform: translateY(0px) rotate(2deg); } 75% { transform: translateY(-2px) rotate(-2deg); } 100% { transform: translateY(0px) rotate(0deg); } }
      html[data-attn="1"] #m { animation: wiggle 0.55s ease-in-out infinite; filter: drop-shadow(0 0 14px rgba(249,115,22,0.95)) drop-shadow(0 10px 16px rgba(0,0,0,0.25)); }
    </style>
  </head>
  <body>
    <div class="wrap" onclick="window.gate1?.ui?.toggleMainWindow?.()">
      <img id="m" src="${svgDataUrlNormal}" alt="Gate1" />
    </div>
  </body>
</html>`;

  void mascotWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

  try {
    mascotWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  } catch {
    // ignore
  }

  const position = () => {
    const display = screen.getPrimaryDisplay();
    const wa = display.workArea;
    const margin = 12;
    const x = wa.x + wa.width - size - margin;
    const y = wa.y + wa.height - size - margin;
    mascotWindow?.setPosition(x, y, false);
    if (messageWindow) {
      // message bubble above mascot
      const msgW = 260;
      const msgH = 72;
      const msgX = wa.x + wa.width - msgW - margin;
      const msgY = y - msgH - 10;
      messageWindow.setBounds({ x: msgX, y: msgY, width: msgW, height: msgH }, false);
    }
  };

  position();
  screen.on('display-metrics-changed', position);
  screen.on('display-added', position);
  screen.on('display-removed', position);

  mascotWindow.on('closed', () => {
    mascotWindow = null;
  });

  ensureMessageWindow();

  // Heartbeat tint (lightweight polling)
  const pingTimer = setInterval(() => {
    if (!mascotWindow) return;
    updateMascotConnectivity();
    pulseMascot('heartbeat');
  }, 2500);

  mascotWindow.on('closed', () => {
    clearInterval(pingTimer);
  });
}

function ensureMessageWindow(): void {
  const force = process.env.FORCE_FLOATING_MASCOT === '1';
  if (process.platform !== 'win32' && !force) return;
  if (messageWindow) return;

  messageWindow = new BrowserWindow({
    width: 260,
    height: 72,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      html, body { width: 100%; height: 100%; margin: 0; background: transparent; }
      .bubble { height: 100%; width: 100%; display: flex; align-items: center; gap: 10px; padding: 10px 12px; box-sizing: border-box;
        border-radius: 18px; border: 1px solid rgba(229,231,235,0.9); background: rgba(255,255,255,0.92);
        box-shadow: 0 18px 40px rgba(0,0,0,0.22); cursor: pointer; }
      .dot { width: 10px; height: 10px; border-radius: 999px; background: #f97316; box-shadow: 0 0 0 4px rgba(249,115,22,0.18); }
      .t { font-family: Arial, sans-serif; font-weight: 800; color: #111827; line-height: 1.1; }
      .s { font-family: Arial, sans-serif; font-size: 12px; color: #6b7280; margin-top: 2px; }
    </style>
  </head>
  <body>
    <div class="bubble" onclick="window.gate1?.ui?.toggleMainWindow?.()">
      <div class="dot"></div>
      <div>
        <div class="t" id="title">Attention</div>
        <div class="s" id="sub">Click to open</div>
      </div>
    </div>
  </body>
</html>`;

  void messageWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

  messageWindow.webContents.on('did-finish-load', () => {
    if (!messageWindow) return;
    if (pendingBubbleReason) {
      // update title/sub then show
      void messageWindow.webContents.executeJavaScript(
        `try { const t=document.getElementById('title'); const s=document.getElementById('sub'); if(t) t.textContent='Attention'; if(s) s.textContent=${JSON.stringify(pendingBubbleReason)}; } catch {}`,
        true
      );
      messageWindow.show();
    }
  });

  try {
    messageWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  } catch {
    // ignore
  }

  // initial position will be set by mascot window positioner if available
  const display = screen.getPrimaryDisplay();
  const wa = display.workArea;
  const margin = 12;
  const msgX = wa.x + wa.width - 260 - margin;
  const msgY = wa.y + wa.height - 72 - 96 - 22;
  messageWindow.setPosition(msgX, msgY, false);

  messageWindow.on('closed', () => {
    messageWindow = null;
  });
}

function showMessageBubble(title: string, sub: string, autoHideMs: number | null): void {
  pendingBubbleReason = sub;
  if (!messageWindow) {
    ensureMessageWindow();
    // will show on did-finish-load
    return;
  }
  void messageWindow.webContents.executeJavaScript(
    `try { const t=document.getElementById('title'); const s=document.getElementById('sub'); if(t) t.textContent=${JSON.stringify(title)}; if(s) s.textContent=${JSON.stringify(sub)}; } catch {}`,
    true
  );

  // show reliably (showInactive can be unreliable on mac)
  messageWindow.show();

  if (autoHideMs != null && autoHideMs > 0) {
    setTimeout(() => {
      if (!messageWindow) return;
      if (pendingBubbleReason === sub) hideMessageBubble();
    }, autoHideMs);
  }
}

function hideMessageBubble(): void {
  messageWindow?.hide();
  pendingBubbleReason = null;
}

function buildCopyStateFromSnapshot(snapshot: SnapshotResult): CopyState {
  const pendingByKey = new Map<string, { name: string; sizeBytes: number }>();
  const hashByKey = new Map<string, string>();
  for (const f of snapshot.files) {
    const key = makeFileKey(f.name, f.sizeBytes);
    pendingByKey.set(key, { name: f.name, sizeBytes: f.sizeBytes });
    hashByKey.set(key, f.quickHash);
  }
  return {
    sessionId: snapshot.sessionId,
    pendingByKey,
    hashByKey,
    copiedKeys: new Set<string>(),
  };
}

async function tryHandleCopiedFile(candidate: CopyCandidate): Promise<void> {
  const active = sdSessionEngine?.getActive();
  if (!active || active.status !== 'active') return;
  if (!copyState || copyState.sessionId !== active.sessionId) return;

  // Wrong destination detection (non-blocking, warn once per directory per session)
  const destDir = path.dirname(candidate.fullPath);
  const unsafe = isUnsafeDestination(destDir);
  const outsideWorkspace = !isInWatchedFolders(candidate.fullPath);

  if ((unsafe.unsafe || outsideWorkspace) && !warnedDestinations.has(destDir)) {
    warnedDestinations.add(destDir);
    const reason = unsafe.reason ?? (outsideWorkspace ? 'OUTSIDE_WORKSPACE' : 'UNKNOWN');
    const suggestedPaths = store.get('config')?.watchedFolders ?? [];

    emitAttentionRequired('WRONG_DESTINATION', {
      reason,
      destDir,
      suggestedPaths,
    });
    audit.warn('copy.wrong_destination', { destDir, reason, suggestedPaths });
    return;
  }

  const key = makeFileKey(candidate.filename, candidate.sizeBytes);
  if (!copyState.pendingByKey.has(key)) return;
  if (copyState.copiedKeys.has(key)) return;

  // Duplication control (non-blocking): if this file's quickHash has been seen in previous sessions,
  // warn once per file per session.
  const qh = copyState.hashByKey.get(key);
  if (qh && dupIndex) {
    const existing = dupIndex.get(qh);
    const warnKey = `${copyState.sessionId}:${qh}`;
    if (existing && !warnedDuplicates.has(warnKey)) {
      warnedDuplicates.add(warnKey);
      emitAttentionRequired('DUPLICATE_FILE', {
        filename: candidate.filename,
        fullPath: candidate.fullPath,
        quickHash: qh,
        existingFilename: existing.filename,
        existingFirstSeenAtIso: existing.firstSeenAtIso,
        existingLastSeenAtIso: existing.lastSeenAtIso,
      });
      audit.warn('copy.duplicate_detected', {
        sessionId: copyState.sessionId,
        filename: candidate.filename,
        quickHash: qh,
        existingFilename: existing.filename,
      });
    }
  }

  copyState.copiedKeys.add(key);

  const filesCopied = copyState.copiedKeys.size;
  const filesPending = Math.max(0, copyState.pendingByKey.size - filesCopied);

  // Update progress via ProgressReporter (rate-limited, offline-queued)
  if (active.serverSessionId && progressReporter) {
    await progressReporter.report({
      serverSessionId: active.serverSessionId,
      filesCopied,
      filesPending,
    });
  }

  // Media ingestion: create/update media record in backend (online or offline-queued)
  try {
    const qh = copyState.hashByKey.get(key) ?? null;
    await queueMediaForBatch({
      filename: candidate.filename,
      fullPath: candidate.fullPath,
      sizeBytes: candidate.sizeBytes,
      checksum: qh,
      createdAtIso: null,
    });
  } catch {
    // non-blocking
  }

  mainWindow?.webContents?.send('copy:file-copied', {
    filename: candidate.filename,
    filesCopied,
    filesPending,
  });
  pulseMascot('copy');
  const nowMs = Date.now();
  const shouldBubble = nowMs - lastCopyBubbleAtMs > 2200;
  if (shouldBubble) lastCopyBubbleAtMs = nowMs;
  setUiState(
    'COPYING_IN_PROGRESS',
    { filesCopied, filesPending, filename: candidate.filename },
    shouldBubble
      ? { bubbleTitle: 'Copying in progress.', bubbleSub: `Copied: ${filesCopied}, Pending: ${filesPending}`, bubbleMs: 3500 }
      : undefined
  );
  audit.info('copy.file_copied', { filename: candidate.filename, filesCopied, filesPending });

  // If copy activity pauses, return to quiet working state.
  if (uiStateAutoRevertTimer) {
    clearTimeout(uiStateAutoRevertTimer);
    uiStateAutoRevertTimer = null;
  }
  uiStatePrev = 'SESSION_ACTIVE';
  uiStateAutoRevertTimer = setTimeout(() => {
    uiStateAutoRevertTimer = null;
    const active = sdSessionEngine?.getActive?.() ?? null;
    setUiState(active && active.status === 'active' ? 'SESSION_ACTIVE' : 'IDLE', { activeSession: active });
  }, 6500);
}

function loadCachedPolicy(deviceId: string): EventPolicy | null {
  const cipher = store.get('eventPolicyCipher');
  if (!cipher) return null;
  return decryptPolicy(deviceId, cipher);
}

function saveCachedPolicy(deviceId: string, policy: EventPolicy): void {
  const cipher = encryptPolicy(deviceId, policy);
  store.set('eventPolicyCipher', cipher);
  cachedEventPolicy = policy;
}

async function refreshEventPolicy(eventId: number): Promise<void> {
  const tokenData = await getToken();
  if (!tokenData || isTokenExpired(tokenData.expiryIso)) return;
  const ping = connectivity.getSnapshot();
  if (!ping.online) return;

  try {
    const data: any = await api.getEvent(eventId);
    const ev = data?.event ?? data;

    const endIso = ev?.end_datetime ?? ev?.end_date ?? null;
    const autoDeleteDateIso = ev?.auto_delete_date ?? null;
    const autoDeleteDaysAfterEnd = ev?.auto_delete_days_after_end ?? null;
    const autoDeleteEnabled = ev?.auto_delete_enabled ?? null;

    const policy: EventPolicy = {
      eventId,
      name: ev?.name,
      startAtIso: ev?.start_date ?? ev?.start_datetime ?? null,
      endAtIso: endIso,
      autoDeleteEnabled: autoDeleteEnabled ?? undefined,
      autoDeleteDateIso,
      autoDeleteDaysAfterEnd,
      calculatedDeleteAtIso: computeDeleteAtIso({
        endDateIso: endIso,
        autoDeleteDateIso,
        autoDeleteDaysAfterEnd,
      }),
      // backend doesn't currently expose this on event; keep nullable for now.
      backupRequired: null,
      cachedAtIso: new Date().toISOString(),
    };

    const deviceId = getOrCreateDeviceId();
    saveCachedPolicy(deviceId, policy);
    audit.info('event.policy_cached', { eventId, calculatedDeleteAtIso: policy.calculatedDeleteAtIso });
    mainWindow?.webContents?.send('event:policy', policy);
  } catch (e) {
    audit.warn('event.policy_cache_failed', { reason: (e as any)?.message ?? 'unknown', eventId });
  }
}

function loadActiveSession(): ActiveSdSession | null {
  const raw = store.get('activeSdSession');
  if (!raw) return null;
  return raw as ActiveSdSession;
}

async function tryStartServerSession(snapshot?: SnapshotResult): Promise<void> {
  const active = sdSessionEngine?.getActive();
  if (!active || active.status !== 'active') return;
  if (!active.binding?.sdCardId) return;
  if (active.serverSessionId) return;

  const tokenData = await getToken();
  if (!tokenData || isTokenExpired(tokenData.expiryIso)) return;

  const snap = snapshot ?? (snapshotEngine ? await snapshotEngine.loadSnapshot(active.sessionId) : null);
  if (!snap) return;

  const ping = connectivity.getSnapshot();

  // Determine event
  let eventId: number | null = null;
  try {
    if (ping.online) {
      const activeEvent = await api.getActiveEvent();
      eventId = activeEvent?.id ?? null;

      // Cache last known active event for offline queuing.
      store.set('lastKnownActiveEventId', eventId);
      store.set('lastKnownActiveEventAtIso', new Date().toISOString());
    }
  } catch {
    eventId = null;
  }

  if (!eventId) {
    // If offline, attempt to use last known active event.
    if (!ping.online) {
      const cachedId = store.get('lastKnownActiveEventId') ?? null;
      eventId = typeof cachedId === 'number' ? cachedId : null;
    }
  }

  if (!eventId) {
    // Active event is required for server session creation.
    // Surface this explicitly instead of silently failing.
    emitAttentionRequired('NO_ACTIVE_EVENT', {
      message: 'No active event is configured. Activate an event in the dashboard to enable server sessions.',
      online: ping.online,
      atIso: new Date().toISOString(),
    });
    audit.warn('session.server_start_blocked_no_active_event', { online: ping.online });
    return;
  }

  // Cache event policy (non-blocking)
  void refreshEventPolicy(eventId);

  const deviceId = getOrCreateDeviceId();
  const payload = {
    event_id: eventId,
    sd_card_id: active.binding.sdCardId,
    camera_number: active.binding.cameraNumber,
    device_id: deviceId,
    files_detected: snap.fileCount,
    total_size_bytes: snap.totalSizeBytes,
  };

  if (!ping.online) {
    offlineQueue.enqueue({ endpoint: '/session/start', method: 'POST', payload });
    sdSessionEngine?.setServerSessionQueued(eventId);
    audit.warn('session.server_start_queued_offline', { eventId, sdCardId: active.binding.sdCardId });
    mainWindow?.webContents?.send('session:server-queued', { eventId });
    return;
  }

  try {
    mainWindow?.webContents?.send('session:server-starting', { eventId });
    const res: any = await api.startServerSession(payload);
    const serverSessionId: string | undefined = res?.session?.session_id;
    if (serverSessionId) {
      sdSessionEngine?.setServerSessionInfo({ serverSessionId, eventId });
      mainWindow?.webContents?.send('session:server-started', { serverSessionId, eventId });
      audit.info('session.server_started', { serverSessionId, eventId });
    }
  } catch (e) {
    // if it fails due to transient connectivity, queue it
    offlineQueue.enqueue({ endpoint: '/session/start', method: 'POST', payload });
    sdSessionEngine?.setServerSessionQueued(eventId);
    audit.warn('session.server_start_failed_queued', { reason: (e as any)?.message ?? 'unknown', eventId });
  }
}

function saveActiveSession(session: ActiveSdSession | null): void {
  if (!session) store.delete('activeSdSession');
  else store.set('activeSdSession', session as any);
}

async function resolveSdBinding(hardwareId: string): Promise<any | null> {
  const ping = connectivity.getSnapshot();
  if (!ping.online) return null;
  try {
    return await api.getSdCard(hardwareId);
  } catch {
    return null;
  }
}

async function refreshAgentConfig(): Promise<void> {
  const agentId = store.get('agentId');
  const tokenData = await getToken();

  if (!agentId || !tokenData || isTokenExpired(tokenData.expiryIso)) return;

  const ping = connectivity.getSnapshot();
  if (!ping.online) return;

  try {
    const res = await api.request({
      method: 'GET',
      url: `/agent/config?agent_id=${encodeURIComponent(agentId)}`,
      timeoutMs: 20000,
    });
    store.set('agentConfig', res);
    lastConfigRefreshAtIso = new Date().toISOString();
    audit.info('agent.config_refreshed');
  } catch (e) {
    audit.warn('agent.config_refresh_failed', { reason: (e as any)?.message ?? 'unknown' });
  }
}

async function drainQueueOnce(): Promise<void> {
  const ping = connectivity.getSnapshot();
  if (!ping.online) return;

  const result = await offlineQueue.drain({
    isOnline: () => true,
    maxProcessed: 20,
    timeBudgetMs: 1200,
    send: async (item) => {
      const res = await api.request({
        method: item.method,
        url: item.endpoint,
        data: item.payload,
        headers: item.headers,
        timeoutMs: 20000,
      });
      audit.info('queue.item_sent', { endpoint: item.endpoint, id: item.id });

      // Apply queued SD binding after it successfully syncs.
      if (item.endpoint === '/agent/sd-card/bind') {
        const p = item.payload as any;
        const hardwareId: string | undefined = p?.hardware_id;
        const cameraNumber: number | undefined = p?.camera_number;
        const sdLabel: string | undefined = p?.sd_label;

        if (hardwareId && cameraNumber && sdLabel) {
          const active = sdSessionEngine?.getActive();
          if (active && active.status === 'active' && active.sdHardwareId === hardwareId) {
            const r: any = res;
            if (r?.sd_card_id) {
              sdSessionEngine?.setBinding({
                sdCardId: r.sd_card_id,
                cameraNumber,
                sdLabel: String(sdLabel).toUpperCase(),
                displayLabel: r.display_label,
              });
              mainWindow?.webContents?.send('sd:recognized', {
                id: r.sd_card_id,
                camera_number: cameraNumber,
                sd_label: String(sdLabel).toUpperCase(),
                display_label: r.display_label,
              });
              audit.info('sd.bind_applied_from_queue', { hardwareId, cameraNumber, sdLabel });
            }
          }
        }
      }

      // Apply queued server session start after it successfully syncs.
      if (item.endpoint === '/session/start') {
        const p = item.payload as any;
        const sdCardId: number | undefined = p?.sd_card_id;
        const eventId: number | undefined = p?.event_id;

        const active = sdSessionEngine?.getActive();
        if (active && active.status === 'active' && active.binding?.sdCardId === sdCardId && eventId) {
          const r: any = res;
          const serverSessionId: string | undefined = r?.session?.session_id;
          if (serverSessionId) {
            sdSessionEngine?.setServerSessionInfo({ serverSessionId, eventId });
            mainWindow?.webContents?.send('session:server-started', { serverSessionId, eventId });
            audit.info('session.server_started_from_queue', { serverSessionId, eventId, sdCardId });
          }
        }
      }
    },
  });

  if (result.processed > 0) {
    lastQueueDrainAtIso = new Date().toISOString();
  }
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 460,
    height: 680,
    resizable: false,
    show: process.platform !== 'win32',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    console.log(`[ui] loading dev renderer: ${devUrl}`);
    void mainWindow.loadURL(devUrl);
  } else {
    console.log('[ui] loading prod renderer file');
    void mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  }

  mainWindow.on('close', (e) => {
    const cfg = store.get('config');
    const minimizeToTray = cfg?.minimizeToTray !== false;

    if (minimizeToTray && !isQuitting) {
      e.preventDefault();
      mainWindow?.hide();
    }
  });
}

function getTrayStatusLabel(): string {
  const snap = connectivity?.getSnapshot();
  const online = snap?.online ?? false;
  const latency = snap?.latencyMs;
  const q = offlineQueue?.size?.() ?? 0;

  if (!online) return `Gate 1 Agent v2 — Offline — Queue: ${q}`;
  if (latency == null) return `Gate 1 Agent v2 — Online — Queue: ${q}`;
  return `Gate 1 Agent v2 — Online (${latency}ms) — Queue: ${q}`;
}

function updateTrayMenu(): void {
  if (!tray) return;

  const label = getTrayStatusLabel();
  if (label === lastTrayStatusLabel) return;
  lastTrayStatusLabel = label;

  const contextMenu = Menu.buildFromTemplate([
    { label, enabled: false },
    { type: 'separator' },
    {
      label: 'Show',
      click: () => {
        mainWindow?.show();
        mainWindow?.focus();
      },
    },
    {
      label: 'Hide',
      click: () => {
        mainWindow?.hide();
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
}

function ensureTray() {
  if (tray) return;

  // Reuse existing repo asset for dev; packaging will ship a dedicated icon later.
  // This keeps the agent usable without adding new binary assets yet.
  const iconCandidates = [
    path.join(app.getAppPath(), '..', 'desktop-agent', 'assets', 'tray-icon.png'),
    path.join(app.getAppPath(), 'assets', 'tray-icon.png'),
    path.join(process.cwd(), 'desktop-agent', 'assets', 'tray-icon.png'),
  ];

  let icon = nativeImage.createEmpty();
  for (const p of iconCandidates) {
    try {
      if (existsSync(p)) {
        const img = nativeImage.createFromPath(p);
        if (!img.isEmpty()) {
          icon = img;
          break;
        }
      }
    } catch {
      // ignore
    }
  }

  tray = new Tray(icon);
  tray.setToolTip(APP_NAME);

  updateTrayMenu();

  tray.on('click', () => {
    if (!mainWindow) return;
    if (mainWindow.isVisible()) mainWindow.hide();
    else {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

async function initCore() {
  // Locked to production API.
  // We keep config storage for future staging/dev, but v2 Windows-first is pinned to production.
  api = new ApiClient(DEFAULT_API_URL);

  // Force persisted config apiUrl back to production if it drifted.
  const cfg = store.get('config');
  if (cfg?.apiUrl !== DEFAULT_API_URL) {
    store.set('config', { ...cfg, apiUrl: DEFAULT_API_URL });
  }

  // Windows auto-start (login item). This is a no-op on non-win32.
  if (process.platform === 'win32' && cfg?.autoStart !== false) {
    try {
      app.setLoginItemSettings({
        openAtLogin: true,
        openAsHidden: true,
        path: process.execPath,
        args: ['--autostart'],
      });
      audit?.info('runtime.autostart_enabled');
    } catch (e) {
      audit?.warn('runtime.autostart_failed', { reason: (e as any)?.message ?? 'unknown' });
    }
  }

  const dataDir = path.join(app.getPath('userData'), 'data');
  audit = new AuditLogger({ dir: dataDir });
  await audit.init();
  offlineQueue = new OfflineQueue({ dir: dataDir });
  await offlineQueue.init();

  dupIndex = new DuplicationIndex({ dir: dataDir });
  await dupIndex.init();

  backupEngine = new BackupEngine({ stateDir: path.join(dataDir, 'backup') });
  backupEngine.on('progress', (p: BackupProgress) => {
    mainWindow?.webContents?.send('backup:progress', p);
    if (uiState === 'BACKUP_IN_PROGRESS') {
      const nowMs = Date.now();
      if (nowMs - lastBackupBubbleAtMs > 3500) {
        lastBackupBubbleAtMs = nowMs;
        showMessageBubble(
          'Backup in progress…',
          `Verified: ${p.completedFiles}/${p.totalFiles} (failed: ${p.failedFiles})`,
          3500
        );
      }
    }
  });
  backupEngine.on('file-error', (e: BackupFileError) => {
    audit.warn('backup.file_error', { sessionId: e.sessionId, relativePath: e.relativePath, message: e.message });
    mainWindow?.webContents?.send('backup:file-error', e);

    void (async () => {
      const it = await issueEngine!.add({
        severity: 'error',
        code: 'BACKUP_FILE_ERROR',
        message: `Backup failed for ${e.relativePath}`,
        data: e,
      });
      await sendCriticalIssueToServer(it);
    })();
  });
  backupEngine.on('complete', (d: any) => {
    audit.info('backup.complete', d);
    mainWindow?.webContents?.send('backup:complete', d);
    if (d?.sessionId) {
      lastBackupSummaryBySessionId[String(d.sessionId)] = {
        completedFiles: Number(d?.completedFiles ?? 0),
        totalFiles: Number(d?.totalFiles ?? 0),
        failedFiles: Number(d?.failedFiles ?? 0),
      };

      try {
        const st = backupEngine?.getStatus?.();
        if (st) {
          const summary: LastBackupSummary = {
            atIso: new Date().toISOString(),
            sessionId: String(st.sessionId),
            destRoot: String(st.destRoot),
            diskLabel: deriveDiskLabel(String(st.destRoot)),
            completedFiles: Number(st.completedFiles ?? 0),
            totalFiles: Number(st.totalFiles ?? 0),
            failedFiles: Number(st.failedFiles ?? 0),
            copiedBytes: Number(st.copiedBytes ?? 0),
            totalBytes: Number(st.totalBytes ?? 0),
          };
          store.set('lastBackupSummary', summary as any);
        }
      } catch {
        // ignore
      }
    }
    setUiState('SESSION_ACTIVE', { backup: { status: 'complete', details: d } }, { bubbleTitle: 'Backup complete.', bubbleSub: '', bubbleMs: 3000 });
  });
  backupEngine.on('error', (e: any) => {
    audit.warn('backup.error', { reason: e?.message ?? 'unknown' });
    mainWindow?.webContents?.send('backup:error', { message: e?.message ?? 'unknown' });

    void (async () => {
      const it = await issueEngine!.add({
        severity: 'error',
        code: 'BACKUP_ERROR',
        message: e?.message ?? 'Backup error',
      });
      await sendCriticalIssueToServer(it);
    })();
  });

  issueEngine = new IssueEngine({ dir: dataDir });
  await issueEngine.init();
  issueEngine.on('updated', (list: Issue[]) => {
    mainWindow?.webContents?.send('issues:updated', list);
    pulseMascot('issues');

    // Mascot-level: notify on *new* unacknowledged critical issue (severity=error)
    const newestCritical = (Array.isArray(list) ? list : []).find((i) => i?.severity === 'error' && !i?.acknowledged);
    if (newestCritical && newestCritical.id !== lastNotifiedCriticalIssueId) {
      lastNotifiedCriticalIssueId = newestCritical.id;
      setUiState(
        'ISSUE_RECORDED',
        { issueId: newestCritical.id, severity: newestCritical.severity, code: newestCritical.code },
        { bubbleTitle: 'Critical issue detected.', bubbleSub: String(newestCritical.message ?? ''), bubbleMs: 4500, revertToPrevMs: 4600 }
      );
    }
  });

  mediaMetadata = new MediaMetadataEngine({ dir: path.join(dataDir, 'media-metadata') });
  await mediaMetadata.init();

  const deviceId = getOrCreateDeviceId();
  audit.info('core.start', { deviceId, apiUrl: DEFAULT_API_URL });

  cachedEventPolicy = loadCachedPolicy(deviceId);

  connectivity = new ConnectivityMonitor(() => api.ping());
  connectivity.start(10_000);

  // Drain queue immediately on startup (best-effort), then periodically.
  void drainQueueOnce();

  progressReporter = new ProgressReporter({
    api,
    queue: offlineQueue,
    isOnline: () => connectivity.getSnapshot().online,
    minIntervalMs: 5000,
  });

  // keep tray label fresh but very cheap
  setInterval(() => {
    updateTrayMenu();
  }, 2000);

  // Backup disk readiness detector (quiet; mascot-level only)
  setInterval(() => {
    void detectBackupDiskReady();
  }, 5000);

  // Windows SD detection (Phase 2)
  if (process.platform === 'win32') {
    const snapshotDir = path.join(dataDir, 'snapshots');
    snapshotEngine = new SnapshotEngine({ outDir: snapshotDir });
    snapshotEngine.on('progress', (p: SnapshotProgress) => {
      mainWindow?.webContents?.send('snapshot:progress', p);
      setMascotMode('snapshot');

      // Quiet: only show an occasional bubble while scanning.
      const nowMs = Date.now();
      if (nowMs - lastSnapshotBubbleAtMs > 6000) {
        lastSnapshotBubbleAtMs = nowMs;
        showMessageBubble('Preparing session…', `Scanning: ${p?.scannedFiles ?? 0} files`, 2500);
      }
    });
    snapshotEngine.on('complete', (r: SnapshotResult) => {
      audit.info('snapshot.complete', { sessionId: r.sessionId, fileCount: r.fileCount, totalSizeBytes: r.totalSizeBytes });
      mainWindow?.webContents?.send('snapshot:complete', r);
      setMascotMode('idle');

      // If we were still in SD_DETECTED, move to SESSION_ACTIVE.
      const active = sdSessionEngine?.getActive?.() ?? null;
      setUiState(active && active.status === 'active' ? 'SESSION_ACTIVE' : 'SESSION_ACTIVE', { activeSession: active }, { bubbleTitle: 'Session active.', bubbleSub: 'You may copy files now.', bubbleMs: 3500 });

      // if binding exists, this will start the server session.
      void tryStartServerSession(r);

      // Initialize copy baseline for this session.
      copyState = buildCopyStateFromSnapshot(r);

      // Reset per-session destination warnings
      warnedDestinations = new Set();
      warnedDuplicates = new Set();

      // Start/refresh file watcher
      const cfg = store.get('config');
      const folders = cfg?.watchedFolders ?? [];
      copyObserver?.start(folders);
    });
    snapshotEngine.on('error', (e: any) => {
      audit.warn('snapshot.error', { reason: e?.message ?? 'unknown' });
      mainWindow?.webContents?.send('snapshot:error', { message: e?.message ?? 'unknown' });
      setMascotMode('idle');

      // Snapshot is foundational for copy verification; treat as attention.
      emitAttentionRequired('SNAPSHOT_ERROR', { message: e?.message ?? 'unknown' });
    });

    sdSessionEngine = new SdSessionEngine({
      load: loadActiveSession,
      save: saveActiveSession,
    });

    sdSessionEngine.on('session-started', (s: ActiveSdSession) => {
      audit.info('session.started_local', { sessionId: s.sessionId, sdHardwareId: s.sdHardwareId });
      mainWindow?.webContents?.send('session:started', s);

      setUiState('SESSION_ACTIVE', { activeSession: { sessionId: s.sessionId } });
    });
    sdSessionEngine.on('session-binding-updated', (s: ActiveSdSession) => {
      mainWindow?.webContents?.send('session:binding', s);
      pulseMascot('binding');

      // binding completed; if snapshot exists, this will start server session
      void tryStartServerSession();
    });

    sdSessionEngine.on('session-server-started', async (s: ActiveSdSession) => {
      audit.info('session.server_started_local', { serverSessionId: s.serverSessionId, eventId: s.eventId });
      pulseMascot('binding');

      // Persist snapshot hashes into duplication index once the server session is real.
      if (s.serverSessionId && snapshotEngine && dupIndex) {
        const snap = await snapshotEngine.loadSnapshot(s.sessionId);
        if (snap) {
          for (const f of snap.files) {
            await dupIndex.upsert({
              quickHash: f.quickHash,
              filename: f.name,
              sizeBytes: f.sizeBytes,
              eventId: s.eventId,
              serverSessionId: s.serverSessionId,
              sdHardwareId: s.sdHardwareId,
            });
          }
          audit.info('duplication.index_updated', { sessionId: s.sessionId, fileCount: snap.fileCount });
        }
      }

      // Backup is manual-only (trigger via IPC backup:start)
    });

    sdSessionEngine.on('session-server-queued', (s: ActiveSdSession) => {
      audit.warn('session.server_queued_local', { eventId: s.eventId });
    });
    sdSessionEngine.on('session-ended', (s: ActiveSdSession) => {
      audit.info('session.ended_local', { sessionId: s.sessionId, sdHardwareId: s.sdHardwareId });
      mainWindow?.webContents?.send('session:ended', s);

      // Ensure any pending media indexes are flushed promptly when a session ends.
      void flushMediaBatch('session_end');

      const { filesCopied, filesPending } = getCopyCounts();
      const b = lastBackupSummaryBySessionId[String(s.sessionId)];
      const backupLine = b
        ? (b.failedFiles > 0 ? `Backup: ${b.completedFiles}/${b.totalFiles} (failed)` : `Backup: ${b.completedFiles}/${b.totalFiles} verified`)
        : 'Backup: not started';

      setUiState(
        'SESSION_CLOSED',
        { sessionId: s.sessionId, filesCopied, filesPending },
        {
          bubbleTitle: 'Session completed successfully.',
          bubbleSub: `Files copied: ${filesCopied} • Pending: ${filesPending} • ${backupLine}`,
          bubbleMs: 5200,
        }
      );

      // Retention notice (calm, once) if policy exists.
      const delIso = cachedEventPolicy?.calculatedDeleteAtIso ?? null;
      if (delIso) {
        const nowMs = Date.now();
        if (nowMs - lastRetentionBubbleAtMs > 20_000) {
          lastRetentionBubbleAtMs = nowMs;
          setUiStateAfter(5600, 'RETENTION_PENDING', { deleteAtIso: delIso });
          setTimeout(() => {
            showMessageBubble('Files will be deleted automatically.', `Scheduled: ${formatEat(String(delIso))}`, 5200);
          }, 5650);
        }
      }

      setUiStateAfter(11_000, 'IDLE', null);

      // stop observing until next session
      copyObserver?.stop();
      copyState = null;

      // stop backup on session end
      backupEngine?.stop();

      // reset warning memory
      warnedDestinations = new Set();
    });

    sdSessionEngine.on('session-resumed', (s: ActiveSdSession) => {
      audit.info('session.resumed_local', { sessionId: s.sessionId, sdHardwareId: s.sdHardwareId });
      mainWindow?.webContents?.send('session:resumed', s);

      // Clear any pending removal state since SD is back
      if (removalPending && removalPending.serverSessionId === s.serverSessionId) {
        audit.info('sd.removal_pending_cleared', { serverSessionId: s.serverSessionId, reason: 'reinserted' });
        removalPending = null;
      }

      // Resume backup if it was paused
      backupEngine?.resume();
    });

    sdSessionEngine.on('session-cleared', (s: ActiveSdSession) => {
      audit.info('session.cleared_local', { sessionId: s.sessionId, sdHardwareId: s.sdHardwareId });
      mainWindow?.webContents?.send('session:cleared', s);
    });

    sdSessionEngine.on('session-overlap-blocked', (data: any) => {
      audit.warn('session.overlap_blocked', data);
      emitAttentionRequired('SD_SESSION_OVERLAP', data);
    });

    // If we restored an active session, surface it.
    const restored = sdSessionEngine.getActive();
    if (restored && restored.status === 'active') {
      mainWindow?.webContents?.send('session:restored', restored);
    }

    sdDetector = new SdDetectorWin();
    sdDetector.on('sd-inserted', (sd: SdCardIdentity) => {
      audit.info('sd.inserted', sd);
      mainWindow?.webContents?.send('sd:inserted', sd);
      pulseMascot('sd');

      sdDetectedAtMs = Date.now();
      setUiState('SD_DETECTED', { sd }, { bubbleTitle: 'SD detected.', bubbleSub: 'Preparing session…', bubbleMs: 3500 });

      const session = sdSessionEngine?.onSdInserted({
        sdHardwareId: sd.hardwareId,
        mountPath: sd.mountPath,
        driveLetter: sd.driveLetter,
      });

      // If overlap was blocked, do not proceed with binding lookup.
      const active = sdSessionEngine?.getActive();
      if (active && active.status === 'active' && active.sdHardwareId !== sd.hardwareId) {
        return;
      }

      // Try resolve binding via API (non-blocking)
      void (async () => {
        const res = await resolveSdBinding(sd.hardwareId);
        if (res?.status === 'found' && res.sd_card) {
          sdSessionEngine?.setBinding({
            sdCardId: res.sd_card.id,
            cameraNumber: res.sd_card.camera_number,
            sdLabel: res.sd_card.sd_label,
            displayLabel: res.sd_card.display_label,
          });
          mainWindow?.webContents?.send('sd:recognized', res.sd_card);
          pulseMascot('sd');

          // Mascot-level: show camera + SD label briefly.
          showMessageBubble(
            'Session active.',
            `Camera: ${res.sd_card.camera_number ?? '-'} • SD: ${res.sd_card.sd_label ?? '-'}`,
            3500
          );

          const active = sdSessionEngine?.getActive();
          if (active && active.status === 'active') {
            setUiState('SESSION_ACTIVE', { activeSession: active });
          }
        } else {
          // Needs binding
          mainWindow?.webContents?.send('sd:needs-binding', {
            hardwareId: sd.hardwareId,
            mountPath: sd.mountPath,
            driveLetter: sd.driveLetter,
            sessionId: session?.sessionId,
          });
          pulseMascot('binding');

          setUiState('SESSION_ACTIVE', { sd, needsBinding: true }, { bubbleTitle: 'Session active.', bubbleSub: 'Bind SD to camera.', bubbleMs: 3500 });
        }
      })();

      // Start snapshot automatically (non-blocking) if not already created.
      if (session && snapshotEngine) {
        void (async () => {
          const existing = await snapshotEngine.loadSnapshot(session.sessionId);
          if (existing) {
            mainWindow?.webContents?.send('snapshot:complete', existing);
            return;
          }
          try {
            mainWindow?.webContents?.send('snapshot:starting', { sessionId: session.sessionId });
            await snapshotEngine.createSnapshot({
              sessionId: session.sessionId,
              sdHardwareId: session.sdHardwareId,
              mountPath: session.mountPath,
            });
          } catch {
            // error handled by engine event
          }
        })();
      }
    });
    sdDetector.on('sd-removed', (sd: SdCardIdentity) => {
      audit.warn('sd.removed', sd);
      mainWindow?.webContents?.send('sd:removed', sd);
      pulseMascot('sd');

      sdSessionEngine?.markRemoved(sd.hardwareId);

      // Pause backup while SD is removed to avoid copy failures
      backupEngine?.pause();

      // SD removal safety check
      const active = sdSessionEngine?.getActive();
      const serverSessionId = active?.serverSessionId;
      if (!active || !serverSessionId) return;

      const { filesCopied, filesPending } = getCopyCounts();
      mainWindow?.webContents?.send('sd:removal-check', {
        serverSessionId,
        filesCopied,
        filesPending,
      });
      pulseMascot('sd');

      setUiState('SD_REMOVAL_CHECK', { serverSessionId, filesCopied, filesPending }, { bubbleTitle: 'Checking SD before removal…', bubbleSub: '', bubbleMs: 2500, autoOpenWindow: true, revertToPrevMs: 2500 });

      if (filesPending <= 0) {
        // Safe removal -> close server session automatically
        void (async () => {
          await flushMediaBatch('session_end');
          const status = await endServerSession({
            serverSessionId,
            removalDecision: 'safe',
            filesCopied,
            filesPending,
          });
          audit.info('sd.removal_safe', { serverSessionId, filesCopied, filesPending, status });
          mainWindow?.webContents?.send('session:ended-server', { serverSessionId, status, removalDecision: 'safe' });
        })();
      } else {
        // Pending files -> require editor decision
        removalPending = { serverSessionId, filesCopied, filesPending };
        emitAttentionRequired('SD_REMOVAL_PENDING', {
          serverSessionId,
          filesCopied,
          filesPending,
        });
        audit.warn('sd.removal_pending', { serverSessionId, filesCopied, filesPending });

        void issueEngine?.add({
          severity: 'warning',
          code: 'SD_REMOVAL_PENDING',
          message: `SD removed before all files copied (${filesPending} pending)`,
          data: { serverSessionId, filesCopied, filesPending },
        });
      }
    });
    sdDetector.start(4000);

    // Copy observer (Phase 4)
    copyObserver = new CopyObserver();
    copyObserver.on('file-added', (c: CopyCandidate) => {
      void tryHandleCopiedFile(c);
    });
    copyObserver.on('file-renamed', (evt: any) => {
      handleRenameGuidance(evt);
    });
    copyObserver.on('error', (e: any) => {
      audit.warn('copy.observer_error', { reason: e?.message ?? 'unknown' });
    });

    // Start watching immediately (no-op if folders empty)
    const cfg = store.get('config');
    copyObserver.start(cfg?.watchedFolders ?? []);
  }

  const saved = await getToken();
  if (saved && !isTokenExpired(saved.expiryIso)) {
    api.setToken(saved.token);
    lastAuthOk = !!store.get('agentId');
    audit.info('auth.token_restored', { expiresAt: saved.expiryIso });
  } else if (saved) {
    await clearToken();
    api.setToken(null);
    lastAuthOk = false;
    audit.warn('auth.token_expired_cleared');
  }

  // Heartbeat loop (only when authenticated and registered)
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  heartbeatTimer = setInterval(async () => {
    const agentId = store.get('agentId');
    const tokenData = await getToken();

    lastAuthOk = !!(agentId && tokenData && !isTokenExpired(tokenData.expiryIso));

    const ping = connectivity.getSnapshot();

    // Keep mascot connectivity state fresh even when the main window isn't open.
    updateMascotConnectivity();

    // online transition detection (sync-on-reconnect)
    if (lastOnline === null) {
      lastOnline = ping.online;
    } else if (lastOnline === false && ping.online === true) {
      lastOnline = true;
      audit.info('connectivity.reconnected');
      // fire-and-forget: do not block heartbeat tick
      void drainQueueOnce();
      void refreshAgentConfig();
      void refreshActiveEventSummary();

      // refresh cached policy on reconnect
      if (cachedEventPolicy?.eventId) {
        void refreshEventPolicy(cachedEventPolicy.eventId);
      }
    } else if (lastOnline === true && ping.online === false) {
      lastOnline = false;
      audit.warn('connectivity.offline');
    }

    if (agentId && tokenData && !isTokenExpired(tokenData.expiryIso)) {
      try {
        if (ping.online) {
          await api.agentHeartbeat({
            agent_id: agentId,
            device_id: deviceId,
            status: 'online',
            latency_ms: ping.latencyMs ?? undefined,
            watched_folders: store.get('config')?.watchedFolders ?? [],
          });
        } else {
          offlineQueue.enqueue({
            endpoint: '/agent/heartbeat',
            method: 'POST',
            payload: {
              agent_id: agentId,
              device_id: deviceId,
              status: 'offline',
              latency_ms: ping.latencyMs ?? undefined,
              watched_folders: store.get('config')?.watchedFolders ?? [],
            },
          });
        }
      } catch {
        offlineQueue.enqueue({
          endpoint: '/agent/heartbeat',
          method: 'POST',
          payload: {
            agent_id: agentId,
            device_id: deviceId,
            status: ping.online ? 'online' : 'offline',
            latency_ms: ping.latencyMs ?? undefined,
            watched_folders: store.get('config')?.watchedFolders ?? [],
          },
        });
      }

      try {
        if (ping.online) {
          await api.userHeartbeat({ activity: 'Idle - Monitoring' });
        } else {
          offlineQueue.enqueue({
            endpoint: '/users/heartbeat',
            method: 'POST',
            payload: { activity: 'Idle - Monitoring' },
          });
        }
      } catch {
        offlineQueue.enqueue({
          endpoint: '/users/heartbeat',
          method: 'POST',
          payload: { activity: 'Idle - Monitoring' },
        });
      }
    }
  }, 60_000);

  // Queue draining loop (small batches, non-blocking)
  if (queueDrainTimer) clearInterval(queueDrainTimer);
  queueDrainTimer = setInterval(async () => {
    await drainQueueOnce();
  }, 5_000);

  // Streaming tunnel worker (agent-side) for proxy-stream
  startStreamTunnelLoop();

  // Periodic config refresh (non-blocking)
  if (configRefreshTimer) clearInterval(configRefreshTimer);
  configRefreshTimer = setInterval(() => {
    void refreshAgentConfig();
    void refreshActiveEventSummary();
  }, 5 * 60_000);

  // initial best-effort refresh (do not block startup)
  void refreshAgentConfig();
  void refreshActiveEventSummary();
}

function registerIpc() {
  ipcMain.handle('ui:pick-folder', async () => {
    const opts: Electron.OpenDialogOptions = {
      properties: ['openDirectory', 'createDirectory'],
      title: 'Select folder',
    };

    const res = mainWindow
      ? await dialog.showOpenDialog(mainWindow, opts)
      : await dialog.showOpenDialog(opts);
    if (res.canceled) return { ok: true, canceled: true, path: null };
    const p = Array.isArray(res.filePaths) && res.filePaths.length > 0 ? res.filePaths[0] : null;
    return { ok: true, canceled: false, path: p };
  });

  ipcMain.handle('ui:trigger-attention-test', async (_evt: IpcMainInvokeEvent, payload?: { reason?: string }) => {
    const reason = payload?.reason ?? 'TEST_ATTENTION_MODAL';
    emitAttentionRequired(reason, {
      message: 'This is a test attention event from Tools → Test Attention Modal.',
      atIso: new Date().toISOString(),
    });
    return { ok: true };
  });

  ipcMain.handle('ui:open-attention-from-bubble', async () => {
    hideMessageBubble();
    showAttentionInWindow();
    setMascotAttention(false);
    return { ok: true };
  });

  ipcMain.handle('attention:dismiss', async () => {
    clearAttentionState();
    return { ok: true };
  });

  ipcMain.handle('ui:toggle-main-window', async () => {
    toggleMainWindow();
    return { ok: true };
  });

  ipcMain.handle('ui:toast', async (_evt: IpcMainInvokeEvent, payload: { kind: string; title: string; message?: string }) => {
    mainWindow?.webContents?.send('ui:toast', payload);
    return { ok: true };
  });

  ipcMain.handle('core:get-status', async () => {
    const cfg = store.get('config');
    const deviceId = getOrCreateDeviceId();
    const token = await getToken();
    const ping = connectivity.getSnapshot();
    const activeSession = sdSessionEngine?.getActive?.() ?? null;

    return {
      apiUrl: DEFAULT_API_URL,
      updateUrl: cfg?.updateUrl || cfg?.apiUrl || DEFAULT_API_URL,
      deviceId,
      agentId: store.get('agentId') || null,
      hasToken: !!token,
      tokenExpired: token ? isTokenExpired(token.expiryIso) : null,
      online: ping.online,
      latencyMs: ping.latencyMs,
      lastPingAtIso: ping.checkedAtIso,
      offlineQueueSize: offlineQueue.size(),
      lastQueueDrainAtIso,
      lastConfigRefreshAtIso,
      eventPolicy: cachedEventPolicy,
      activeEvent: {
        id: store.get('activeEventId') ?? null,
        name: store.get('activeEventName') ?? null,
        fetchedAtIso: store.get('activeEventFetchedAtIso') ?? null,
      },
      lastKnownActiveEventId: store.get('lastKnownActiveEventId') ?? null,
      lastKnownActiveEventAtIso: store.get('lastKnownActiveEventAtIso') ?? null,
      mountedSds: sdDetector?.getMounted?.() ?? [],
      watchedFolders: cfg?.watchedFolders ?? [],
      backupEnabled: cfg?.backupEnabled ?? false,
      backupDestination: cfg?.backupDestination ?? null,
      backupDestinations: cfg?.backupDestinations ?? [],
      minimizeToTray: cfg?.minimizeToTray !== false,
      activeSession: activeSession
        ? {
            sessionId: activeSession.sessionId,
            sdHardwareId: activeSession.sdHardwareId,
            mountPath: activeSession.mountPath,
            status: activeSession.status,
            serverSessionId: activeSession.serverSessionId ?? null,
            eventId: activeSession.eventId ?? null,
          }
        : null,
      platform: os.platform(),
    };
  });

  ipcMain.handle('backup:get-config', async () => {
    const cfg = store.get('config');
    return {
      backupEnabled: cfg?.backupEnabled ?? false,
      backupDestination: cfg?.backupDestination ?? null,
      backupDestinations: cfg?.backupDestinations ?? [],
    };
  });

  ipcMain.handle(
    'backup:set-config',
    async (
      _evt: IpcMainInvokeEvent,
      payload: { backupEnabled?: boolean; backupDestination?: string | null }
    ) => {
      const prev = store.get('config');
      const next = {
        ...prev,
        backupEnabled: payload.backupEnabled ?? prev?.backupEnabled ?? false,
        backupDestination: payload.backupDestination ?? prev?.backupDestination ?? null,
      };
      store.set('config', next);
      audit.info('config.backup_set', {
        backupEnabled: next.backupEnabled,
        backupDestination: next.backupDestination,
      });
      return { ok: true };
    }
  );

  ipcMain.handle(
    'backup:set-destinations',
    async (_evt: IpcMainInvokeEvent, payload: { destinations: string[] }) => {
      const prev = store.get('config');
      const unique = Array.from(new Set((payload.destinations ?? []).filter(Boolean)));
      store.set('config', { ...prev, backupDestinations: unique });
      audit.info('config.backup_destinations_set', { count: unique.length });
      return { ok: true };
    }
  );

  ipcMain.handle('backup:list-destinations', async () => {
    const cfg = store.get('config');
    const list: string[] = [];
    if (cfg?.backupDestination) list.push(cfg.backupDestination);
    if (Array.isArray(cfg?.backupDestinations)) list.push(...cfg.backupDestinations);
    const uniq = Array.from(new Set(list.filter(Boolean)));

    const result = [] as Array<{ path: string; exists: boolean; writable: boolean; reason?: string }>;
    for (const p of uniq) {
      const info = await checkWritableDir(p);
      result.push({ path: p, ...info });
    }
    return result;
  });

  ipcMain.handle('backup:get-overview', async () => {
    const active = sdSessionEngine?.getActive?.() ?? null;
    const status = backupEngine?.getStatus?.() ?? null;
    const last = (store.get('lastBackupSummary') as any) ?? null;

    let remainingFiles: number | null = null;
    let remainingBytes: number | null = null;
    let totalFiles: number | null = null;
    let totalBytes: number | null = null;

    let completionPct: number | null = null;
    let matchedNormal: number | null = null;
    let matchedRenamed: number | null = null;
    let pendingCount: number | null = null;
    let pendingDetails: Array<{ name: string; relativePath: string; sizeBytes: number }> = [];

    if (active?.status === 'active' && snapshotEngine) {
      const snap = await snapshotEngine.loadSnapshot(active.sessionId);
      if (snap) {
        totalFiles = snap.files.length;
        totalBytes = snap.totalSizeBytes;

        const destRoot = status?.destRoot ?? last?.destRoot ?? null;
        const destSessionDir = destRoot ? path.join(String(destRoot), String(snap.sessionId)) : null;

        if (destSessionDir && existsSync(destSessionDir)) {
          const scan = await scanBackupQuickHashes({
            destSessionDir,
            cacheKey: `${destSessionDir}:${totalFiles}:${totalBytes}`,
          });

          let normal = 0;
          let renamed = 0;
          const maxPending = 25;

          for (const f of snap.files) {
            const expected = path.join(destSessionDir, f.relativePath);
            let isNormal = false;
            try {
              const st = fsSync.statSync(expected);
              if (st.isFile() && st.size === f.sizeBytes) {
                const qh = await computeQuickHash(expected, st.size);
                if (qh === f.quickHash) isNormal = true;
              }
            } catch {
              // not normal
            }

            if (isNormal) {
              normal += 1;
              continue;
            }

            if (scan.has(f.quickHash)) {
              renamed += 1;
              continue;
            }

            if (pendingDetails.length < maxPending) {
              pendingDetails.push({ name: f.name, relativePath: f.relativePath, sizeBytes: f.sizeBytes });
            }
          }

          matchedNormal = normal;
          matchedRenamed = renamed;
          pendingCount = Math.max(0, totalFiles - normal - renamed);
          remainingFiles = pendingCount;

          const done = normal + renamed;
          completionPct = totalFiles > 0 ? Math.round((done / totalFiles) * 100) : 0;

          // bytes remaining best-effort: sum pending bytes
          const pendingBytes = snap.files
            .filter((f) => {
              // recompute quickly based on above counters is expensive; use scan presence and expected path
              const expected = path.join(destSessionDir, f.relativePath);
              try {
                const st = fsSync.statSync(expected);
                if (st.isFile() && st.size === f.sizeBytes) {
                  // If exists and matches hash it was normal; but we can't hash again cheaply here; approximate by presence in scan
                  // We will treat as present if scan contains quickHash.
                }
              } catch {
                // ignore
              }
              return !scan.has(f.quickHash);
            })
            .reduce((acc, f) => acc + (f.sizeBytes ?? 0), 0);
          remainingBytes = pendingBytes;
        } else {
          // no backup dir yet
          remainingFiles = totalFiles;
          remainingBytes = totalBytes;
          completionPct = 0;
          matchedNormal = 0;
          matchedRenamed = 0;
          pendingCount = totalFiles;
          pendingDetails = snap.files.slice(0, 25).map((f) => ({ name: f.name, relativePath: f.relativePath, sizeBytes: f.sizeBytes }));
        }
      }
    }

    return {
      last,
      status,
      activeSessionId: active?.sessionId ?? null,
      remaining: {
        totalFiles,
        totalBytes,
        remainingFiles,
        remainingBytes,
      },
      completion: {
        percent: completionPct,
        matchedNormal,
        matchedRenamed,
        pendingCount,
        pendingDetails,
      },
      unbackedUpClips: remainingFiles,
    };
  });

  ipcMain.handle('backup:start', async (_evt: IpcMainInvokeEvent, payload: { destRoot?: string }) => {
    const active = sdSessionEngine?.getActive();
    if (!active || active.status !== 'active' || !active.serverSessionId) {
      return { ok: false, reason: 'no_active_server_session' };
    }
    if (!snapshotEngine || !backupEngine) return { ok: false, reason: 'no_engine' };

    const cfg = store.get('config');
    const last = store.get('lastBackupSummary') as any;
    const lastDest = last?.destRoot ? String(last.destRoot) : null;

    // Auto-pick disk + folder when not explicitly overridden
    let destRoot = payload.destRoot && payload.destRoot.trim().length > 0 ? payload.destRoot.trim() : '';
    if (!destRoot) {
      const candidates: string[] = [];
      if (lastDest) candidates.push(lastDest);
      if (cfg?.backupDestination) candidates.push(String(cfg.backupDestination));
      if (Array.isArray(cfg?.backupDestinations)) candidates.push(...cfg.backupDestinations.map(String));
      const uniq = Array.from(new Set(candidates.filter((s) => typeof s === 'string' && s.trim().length > 0)));

      for (const p of uniq) {
        const info = await checkWritableDir(p);
        if (info.exists && info.writable) {
          destRoot = p;
          break;
        }
      }
    }

    if (!destRoot) return { ok: false, reason: 'no_writable_backup_disk' };

    const snap = await snapshotEngine.loadSnapshot(active.sessionId);
    if (!snap) return { ok: false, reason: 'no_snapshot' };

    try {
      audit.info('backup.manual_start', { sessionId: active.sessionId, serverSessionId: active.serverSessionId, destRoot });
      mainWindow?.webContents?.send('backup:starting', { sessionId: active.sessionId });
      setUiState('BACKUP_IN_PROGRESS', { sessionId: active.sessionId }, { bubbleTitle: 'Backup in progress…', bubbleSub: '', bubbleMs: 2500 });
      await backupEngine.start({ snapshot: snap, destRoot });
      const stillActive = sdSessionEngine?.getActive?.();
      setUiState(stillActive && stillActive.status === 'active' ? 'SESSION_ACTIVE' : 'IDLE', { activeSession: stillActive });

      // persist last known backup destination immediately (operational-first)
      try {
        const st = backupEngine.getStatus();
        if (st) {
          const summary: LastBackupSummary = {
            atIso: new Date().toISOString(),
            sessionId: String(st.sessionId),
            destRoot: String(st.destRoot),
            diskLabel: deriveDiskLabel(String(st.destRoot)),
            completedFiles: Number(st.completedFiles ?? 0),
            totalFiles: Number(st.totalFiles ?? 0),
            failedFiles: Number(st.failedFiles ?? 0),
            copiedBytes: Number(st.copiedBytes ?? 0),
            totalBytes: Number(st.totalBytes ?? 0),
          };
          store.set('lastBackupSummary', summary as any);
        }
      } catch {
        // ignore
      }
      return { ok: true };
    } catch (e: any) {
      audit.warn('backup.manual_start_failed', { reason: e?.message ?? 'unknown' });
      const stillActive = sdSessionEngine?.getActive?.();
      setUiState(stillActive && stillActive.status === 'active' ? 'SESSION_ACTIVE' : 'IDLE', { activeSession: stillActive });
      return { ok: false, reason: e?.message ?? 'unknown' };
    }
  });

  ipcMain.handle('backup:get-status', async () => {
    return backupEngine?.getStatus() ?? null;
  });

  ipcMain.handle('backup:pause', async () => {
    backupEngine?.pause();
    audit.info('backup.manual_pause', { status: backupEngine?.getStatus() ?? null });
    mainWindow?.webContents?.send('backup:status', backupEngine?.getStatus() ?? null);
    return { ok: true };
  });

  ipcMain.handle('backup:resume', async () => {
    backupEngine?.resume();
    audit.info('backup.manual_resume', { status: backupEngine?.getStatus() ?? null });
    mainWindow?.webContents?.send('backup:status', backupEngine?.getStatus() ?? null);
    return { ok: true };
  });

  ipcMain.handle('backup:retry-failed', async () => {
    if (!backupEngine) return { ok: false, reason: 'no_engine' };
    await backupEngine.clearFailed();
    backupEngine.resume();
    audit.info('backup.manual_retry_failed', { status: backupEngine.getStatus() ?? null });
    mainWindow?.webContents?.send('backup:status', backupEngine.getStatus() ?? null);
    return { ok: true };
  });

  ipcMain.handle('issues:list', async () => {
    return issueEngine?.list() ?? [];
  });

  ipcMain.handle('issues:ack', async (_evt: IpcMainInvokeEvent, payload: { id: string }) => {
    const ok = await issueEngine?.acknowledge(payload.id);
    return { ok: !!ok };
  });

  ipcMain.handle('issues:clear', async () => {
    await issueEngine?.clear();
    return { ok: true };
  });

  ipcMain.handle(
    'issues:report',
    async (
      _evt: IpcMainInvokeEvent,
      payload: { severity: 'info' | 'warning' | 'error'; code?: string; message: string; data?: unknown }
    ) => {
      const sev = payload?.severity ?? 'warning';
      const code = (payload?.code && payload.code.trim().length ? payload.code.trim() : 'USER_REPORTED').toUpperCase();
      const message = payload?.message?.trim() ?? '';
      if (!message) return { ok: false, reason: 'missing_message' };

      const local = await issueEngine!.add({
        severity: sev,
        code,
        message,
        data: payload?.data ?? null,
      });

      const status = await sendCriticalIssueToServer(local);
      pulseMascot('issues');
      setUiState(
        'ISSUE_RECORDED',
        { issueId: local.id, severity: local.severity, code: local.code },
        { bubbleTitle: 'Issue recorded successfully.', bubbleSub: '', bubbleMs: 2500, revertToPrevMs: 2600 }
      );
      return { ok: true, issue: local, status: status === 'skipped' ? 'local_only' : status };
    }
  );

  ipcMain.handle(
    'media:get-metadata',
    async (_evt: IpcMainInvokeEvent, payload: { sessionId: string; relativePath: string }) => {
      if (!snapshotEngine || !mediaMetadata) return { ok: false, reason: 'no_engine' };
      const snap = await snapshotEngine.loadSnapshot(payload.sessionId);
      if (!snap) return { ok: false, reason: 'no_snapshot' };

      const fullPath = path.join(snap.mountPath, payload.relativePath);
      const res = await mediaMetadata.get({
        sessionId: payload.sessionId,
        relativePath: payload.relativePath,
        fullPath,
      });

      if (!res.ok && res.reason === 'ffprobe_not_found') {
        void issueEngine?.add({
          severity: 'info',
          code: 'MEDIA_METADATA_UNAVAILABLE',
          message: 'ffprobe not found on PATH; media metadata extraction disabled',
          data: { reason: res.reason },
        });
      }

      if (!res.ok && res.reason !== 'ffprobe_not_found') {
        void issueEngine?.add({
          severity: 'warning',
          code: 'MEDIA_METADATA_ERROR',
          message: `Media metadata failed for ${payload.relativePath} (${res.reason})`,
          data: { sessionId: payload.sessionId, relativePath: payload.relativePath, reason: res.reason, details: res.details ?? null },
        });
      }

      return res;
    }
  );

  ipcMain.handle('config:get-watched-folders', async () => {
    return store.get('config')?.watchedFolders ?? [];
  });

  ipcMain.handle('config:set-watched-folders', async (_evt: IpcMainInvokeEvent, { folders }: { folders: string[] }) => {
    const unique = Array.from(new Set((folders || []).filter(Boolean)));
    store.set('config', { ...store.get('config'), watchedFolders: unique });
    audit.info('config.watched_folders_set', { count: unique.length });
    copyObserver?.start(unique);
    return { ok: true };
  });

  ipcMain.handle('config:get', async () => {
    return store.get('config');
  });

  ipcMain.handle(
    'config:set-minimize-to-tray',
    async (_evt: IpcMainInvokeEvent, payload: { minimizeToTray: boolean }) => {
      const prev = store.get('config');
      store.set('config', { ...prev, minimizeToTray: !!payload.minimizeToTray });
      audit.info('config.minimize_to_tray_set', { minimizeToTray: !!payload.minimizeToTray });
      return { ok: true };
    }
  );

  ipcMain.handle(
    'attention:decision',
    async (
      _evt: IpcMainInvokeEvent,
      payload: { reason: string; decision: string; details?: unknown }
    ) => {
      const active = sdSessionEngine?.getActive();
      const ctx = {
        localSessionId: active?.sessionId ?? null,
        serverSessionId: active?.serverSessionId ?? null,
        eventId: active?.eventId ?? null,
        sdHardwareId: active?.sdHardwareId ?? null,
        cameraNumber: active?.binding?.cameraNumber ?? null,
        sdLabel: active?.binding?.sdLabel ?? null,
      };

      audit.info('attention.decision', {
        reason: payload.reason,
        decision: payload.decision,
        details: payload.details ?? null,
        ctx,
      });

      mainWindow?.webContents?.send('attention:decision-recorded', {
        reason: payload.reason,
        decision: payload.decision,
      });

      // Mark attention as handled: revert mascot + hide bubble.
      // (The UI modal will close itself on button click.)
      clearAttentionState();
      return { ok: true };
    }
  );

  ipcMain.handle(
    'sd:removal-decision',
    async (
      _evt: IpcMainInvokeEvent,
      payload: { decision: 'reinsert' | 'confirm_early_removal' }
    ) => {
      if (!removalPending) return { ok: false, reason: 'no_pending_removal' };

      const { serverSessionId, filesCopied, filesPending } = removalPending;

      if (payload.decision === 'reinsert') {
        audit.info('sd.removal_decision', { serverSessionId, decision: 'reinsert' });
        mainWindow?.webContents?.send('sd:removal-decision-recorded', { serverSessionId, decision: 'reinsert' });

        // Decision made; stop attention state.
        clearAttentionState();
        // Do not end session. Reinsertion logic will resume.
        return { ok: true };
      }

      // Confirm early removal: end server session with early_confirmed
      await flushMediaBatch('session_end');
      const status = await endServerSession({
        serverSessionId,
        removalDecision: 'early_confirmed',
        filesCopied,
        filesPending,
      });

      audit.warn('sd.early_removal_confirmed', { serverSessionId, filesCopied, filesPending, status });
      mainWindow?.webContents?.send('sd:removal-decision-recorded', { serverSessionId, decision: 'confirm_early_removal' });
      mainWindow?.webContents?.send('session:ended-server', { serverSessionId, status, removalDecision: 'early_confirmed' });

      setUiState(
        'EARLY_REMOVAL_CONFIRMED',
        { serverSessionId, filesCopied, filesPending },
        { bubbleTitle: 'SD removed early.', bubbleSub: 'Files were not fully copied.', autoOpenWindow: true }
      );

      removalPending = null;

      // Decision made; stop attention state.
      clearAttentionState();
      return { ok: true, status };
    }
  );

  ipcMain.handle('sd:get-mounted', async () => {
    return sdDetector?.getMounted?.() ?? [];
  });

  ipcMain.handle('snapshot:get', async (_evt: IpcMainInvokeEvent, { sessionId }: { sessionId: string }) => {
    if (!snapshotEngine) return null;
    return snapshotEngine.loadSnapshot(sessionId);
  });

  ipcMain.handle(
    'session:update-progress',
    async (
      _evt: IpcMainInvokeEvent,
      params: { filesCopied: number; filesPending: number }
    ) => {
      const active = sdSessionEngine?.getActive();
      const serverSessionId = active?.serverSessionId;
      if (!active || active.status !== 'active' || !serverSessionId) {
        return { ok: false, reason: 'no_active_server_session' };
      }

      const r = await progressReporter?.report({
        serverSessionId,
        filesCopied: params.filesCopied,
        filesPending: params.filesPending,
      });

      audit.info('session.progress_report', {
        serverSessionId,
        filesCopied: params.filesCopied,
        filesPending: params.filesPending,
        status: r?.status ?? 'skipped',
      });

      // Keep renderer informed, but don't spam.
      if (r && r.status !== 'skipped') {
        mainWindow?.webContents?.send('session:progress', {
          serverSessionId,
          filesCopied: params.filesCopied,
          filesPending: params.filesPending,
          status: r.status,
        });
      }

      return { ok: true, status: r?.status ?? 'skipped' };
    }
  );

  ipcMain.handle(
    'sd:bind',
    async (
      _evt: IpcMainInvokeEvent,
      params: { hardwareId: string; cameraNumber: number; sdLabel: string; capacityBytes?: number }
    ) => {
      const payload = {
        hardware_id: params.hardwareId,
        camera_number: params.cameraNumber,
        sd_label: params.sdLabel,
        capacity_bytes: params.capacityBytes,
      };

      const ping = connectivity.getSnapshot();
      if (!ping.online) {
        offlineQueue.enqueue({ endpoint: '/agent/sd-card/bind', method: 'POST', payload });
        audit.warn('sd.bind_queued_offline', { hardwareId: params.hardwareId });
        return { status: 'queued_offline' };
      }

      const res = await api.bindSdCard(payload);
      audit.info('sd.bound', { hardwareId: params.hardwareId, cameraNumber: params.cameraNumber, sdLabel: params.sdLabel });

      // Update current session binding immediately
      sdSessionEngine?.setBinding({
        sdCardId: res.sd_card_id,
        cameraNumber: params.cameraNumber,
        sdLabel: params.sdLabel.toUpperCase(),
        displayLabel: res.display_label,
      });

      // After binding, also emit recognized
      mainWindow?.webContents?.send('sd:recognized', {
        id: res.sd_card_id,
        camera_number: params.cameraNumber,
        sd_label: params.sdLabel.toUpperCase(),
        display_label: res.display_label,
      });
      pulseMascot('binding');

      return res;
    }
  );

  ipcMain.handle(
    'auth:login',
    async (_evt: IpcMainInvokeEvent, { email, password }: { email: string; password: string }) => {
      audit.info('auth.login_attempt');
      const res = await api.login(email, password);

      const expiryIso = new Date(Date.now() + res.authorization.expires_in * 1000).toISOString();
      await setToken(res.authorization.token, expiryIso);
      api.setToken(res.authorization.token);
      lastAuthOk = !!store.get('agentId');
      updateMascotConnectivity();
      audit.info('auth.login_success', { userId: res.user.id, expiresAt: expiryIso });

      return { user: res.user, expiresAt: expiryIso };
    }
  );

  ipcMain.handle('auth:logout', async () => {
    audit.info('auth.logout');
    await clearToken();
    api.setToken(null);
    lastAuthOk = false;
    updateMascotConnectivity();
    return { ok: true };
  });

  ipcMain.handle('auth:me', async () => {
    return api.me();
  });

  ipcMain.handle(
    'agent:register',
    async (_evt: IpcMainInvokeEvent, { editorName, groupCode }: { editorName: string; groupCode?: string }) => {
      const deviceId = getOrCreateDeviceId();
      const cfg = store.get('config');
      api.setBaseUrl(cfg.apiUrl);

      audit.info('agent.register_attempt', { editorName, hasGroupCode: !!groupCode });

      let res: any;
      try {
        res = await api.registerAgent({
          editor_name: editorName,
          device_id: deviceId,
          os: `Windows (${os.release()})`,
          agent_version: app.getVersion(),
          group_code: groupCode,
        });
      } catch (e) {
        // if this fails due to transient network issues, queue it and return a non-blocking response
        offlineQueue.enqueue({
          endpoint: '/agent/register',
          method: 'POST',
          payload: {
            editor_name: editorName,
            device_id: deviceId,
            os: `Windows (${os.release()})`,
            agent_version: app.getVersion(),
            group_code: groupCode,
          },
        });
        audit.warn('agent.register_queued_offline', { reason: (e as any)?.message ?? 'unknown' });
        return { status: 'queued_offline' };
      }

      if (res?.agent_id) {
        store.set('agentId', res.agent_id);
        audit.info('agent.register_success', { agentId: res.agent_id, deviceId });

        // become "ready" quickly: sync any queued ops and refresh config (non-blocking)
        void drainQueueOnce();
        void refreshAgentConfig();
      }

      return res;
    }
  );

  ipcMain.handle('config:set-api-url', async () => {
    // Production-locked build.
    return { ok: false, reason: 'production_locked' };
  });

  ipcMain.handle('config:set-update-url', async (_evt: IpcMainInvokeEvent, { updateUrl }: { updateUrl: string }) => {
    // Update URL is configurable (for future auto-updater), but does not run updates yet.
    store.set('config', { ...store.get('config'), updateUrl });
    audit.info('config.update_url_set', { updateUrl });
    return { ok: true };
  });
}

app.whenReady().then(async () => {
  await initCore();
  registerIpc();
  createMainWindow();
  ensureMascotWindow();
  ensureTray();

  // Start hidden ONLY if actually launched at login
  if (process.platform === 'win32' && wasAutoStarted) {
    mainWindow?.hide();
  }
});

app.on('window-all-closed', () => {
  // Keep agent running in background (Windows-first).
  // Quitting is only via tray menu.
});

app.on('before-quit', () => {
  isQuitting = true;

  // Best-effort: flush any pending media batch so file indexes aren't lost.
  void flushMediaBatch('shutdown');
});

app.on('activate', () => {
  mainWindow?.show();
  mainWindow?.focus();
});
