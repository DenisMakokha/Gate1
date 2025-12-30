import { contextBridge, ipcRenderer } from 'electron';

type Unsubscribe = () => void;

function on(channel: string, handler: (...args: any[]) => void): Unsubscribe {
  const listener = (_evt: Electron.IpcRendererEvent, ...args: any[]) => handler(...args);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

const allowedEventChannels = new Set<string>([
  'attention:required',
  'rename:tip',
  'copy:file-copied',
  'copy:file-renamed',
  'ui:toast',
  'ui:state',
  'event:policy',
  'session:server-queued',
  'session:server-starting',
  'session:server-started',
  'sd:inserted',
  'sd:recognized',
  'sd:needs-binding',
  'sd:removed',
  'sd:removal-check',
  'snapshot:starting',
  'snapshot:progress',
  'snapshot:complete',
  'snapshot:error',
  'session:started',
  'session:binding',
  'session:ended',
  'session:resumed',
  'session:cleared',
  'session:restored',
  'backup:starting',
  'backup:progress',
  'backup:file-error',
  'backup:complete',
  'backup:error',
  'backup:status',
  'backup:needs-binding',
  'issues:updated',
  'session:progress',
  'attention:decision-recorded',
  'sd:removal-decision-recorded',
  'session:ended-server',
]);

const gate1 = {
  core: {
    getStatus: () => ipcRenderer.invoke('core:get-status') as Promise<any>,
  },
  auth: {
    login: (payload: { email: string; password: string }) => ipcRenderer.invoke('auth:login', payload) as Promise<any>,
    me: () => ipcRenderer.invoke('auth:me') as Promise<any>,
    logout: () => ipcRenderer.invoke('auth:logout') as Promise<any>,
  },
  agent: {
    register: (payload: { editorName: string; groupCode?: string }) => ipcRenderer.invoke('agent:register', payload) as Promise<any>,
  },
  ui: {
    pickFolder: () => ipcRenderer.invoke('ui:pick-folder') as Promise<any>,
    triggerAttentionTest: (payload?: { reason?: string }) =>
      ipcRenderer.invoke('ui:trigger-attention-test', payload ?? null) as Promise<any>,
    toggleMainWindow: () => ipcRenderer.invoke('ui:toggle-main-window') as Promise<any>,
    openAttentionFromBubble: () => ipcRenderer.invoke('ui:open-attention-from-bubble') as Promise<any>,
    toast: (payload: { kind: string; title: string; message?: string }) => ipcRenderer.invoke('ui:toast', payload) as Promise<any>,
  },
  config: {
    getWatchedFolders: () => ipcRenderer.invoke('config:get-watched-folders') as Promise<string[]>,
    setWatchedFolders: (payload: { folders: string[] }) =>
      ipcRenderer.invoke('config:set-watched-folders', payload) as Promise<any>,
    get: () => ipcRenderer.invoke('config:get') as Promise<any>,
    setMinimizeToTray: (payload: { minimizeToTray: boolean }) =>
      ipcRenderer.invoke('config:set-minimize-to-tray', payload) as Promise<any>,
    setUpdateUrl: (payload: { updateUrl: string }) => ipcRenderer.invoke('config:set-update-url', payload) as Promise<any>,
  },
  attention: {
    decision: (payload: { reason: string; decision: string; details?: unknown }) =>
      ipcRenderer.invoke('attention:decision', payload) as Promise<any>,
    dismiss: () => ipcRenderer.invoke('attention:dismiss') as Promise<any>,
  },
  sd: {
    removalDecision: (payload: { decision: 'reinsert' | 'confirm_early_removal' }) =>
      ipcRenderer.invoke('sd:removal-decision', payload) as Promise<any>,
    bind: (payload: { hardwareId: string; cameraNumber: number; sdLabel: string; capacityBytes?: number }) =>
      ipcRenderer.invoke('sd:bind', payload) as Promise<any>,
    getMounted: () => ipcRenderer.invoke('sd:get-mounted') as Promise<any>,
  },
  events: {
    on: (channel: string, handler: (...args: any[]) => void) => {
      if (!allowedEventChannels.has(channel)) {
        throw new Error('event_channel_not_allowed');
      }
      return on(channel, handler);
    },
  },
  snapshot: {
    get: (payload: { sessionId: string }) => ipcRenderer.invoke('snapshot:get', payload) as Promise<any>,
  },
  session: {
    updateProgress: (payload: { filesCopied: number; filesPending: number }) =>
      ipcRenderer.invoke('session:update-progress', payload) as Promise<any>,
  },
  issues: {
    list: () => ipcRenderer.invoke('issues:list') as Promise<any>,
    ack: (payload: { id: string }) => ipcRenderer.invoke('issues:ack', payload) as Promise<any>,
    clear: () => ipcRenderer.invoke('issues:clear') as Promise<any>,
    report: (payload: { severity: 'info' | 'warning' | 'error'; code?: string; message: string; data?: unknown }) =>
      ipcRenderer.invoke('issues:report', payload) as Promise<any>,
    onUpdated: (handler: (list: any[]) => void) => on('issues:updated', handler),
  },
  media: {
    getMetadata: (payload: { sessionId: string; relativePath: string }) =>
      ipcRenderer.invoke('media:get-metadata', payload) as Promise<any>,
  },
  backup: {
    getConfig: () => ipcRenderer.invoke('backup:get-config') as Promise<any>,
    setConfig: (payload: { backupEnabled?: boolean; backupDestination?: string | null }) =>
      ipcRenderer.invoke('backup:set-config', payload) as Promise<any>,

    setDestinations: (payload: { destinations: string[] }) =>
      ipcRenderer.invoke('backup:set-destinations', payload) as Promise<any>,

    listDestinations: () => ipcRenderer.invoke('backup:list-destinations') as Promise<any>,

    start: (payload: { destRoot?: string }) => ipcRenderer.invoke('backup:start', payload) as Promise<any>,

    getStatus: () => ipcRenderer.invoke('backup:get-status') as Promise<any>,
    getOverview: () => ipcRenderer.invoke('backup:get-overview') as Promise<any>,
    pause: () => ipcRenderer.invoke('backup:pause') as Promise<any>,
    resume: () => ipcRenderer.invoke('backup:resume') as Promise<any>,
    retryFailed: () => ipcRenderer.invoke('backup:retry-failed') as Promise<any>,

    // Hard drive binding
    bindDrive: (payload: { drivePath: string; driveLabel: string; driveSerial?: string }) =>
      ipcRenderer.invoke('backup:bind-drive', payload) as Promise<any>,
    listBoundDrives: () => ipcRenderer.invoke('backup:list-bound-drives') as Promise<any>,
    unbindDrive: (payload: { drivePath: string }) =>
      ipcRenderer.invoke('backup:unbind-drive', payload) as Promise<any>,

    onProgress: (handler: (p: any) => void) => on('backup:progress', handler),
    onStatus: (handler: (s: any) => void) => on('backup:status', handler),
    onFileError: (handler: (e: any) => void) => on('backup:file-error', handler),
    onComplete: (handler: (d: any) => void) => on('backup:complete', handler),
    onError: (handler: (e: any) => void) => on('backup:error', handler),
  },
  copy: {
    getState: () => ipcRenderer.invoke('copy:get-state') as Promise<any>,
    getSuggestedFolder: () => ipcRenderer.invoke('copy:get-suggested-folder') as Promise<any>,
    createSdFolder: (payload: { folderPath: string }) =>
      ipcRenderer.invoke('copy:create-sd-folder', payload) as Promise<any>,
    onFileCopied: (handler: (d: any) => void) => on('copy:file-copied', handler),
    onFileRenamed: (handler: (d: any) => void) => on('copy:file-renamed', handler),
  },
};

contextBridge.exposeInMainWorld('gate1', gate1);
