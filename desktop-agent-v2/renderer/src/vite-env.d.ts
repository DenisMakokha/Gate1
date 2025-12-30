/// <reference types="vite/client" />

declare global {
  interface Window {
    gate1?: {
      core: { getStatus: () => Promise<any> };
      auth?: {
        login: (payload: { email: string; password: string }) => Promise<any>;
        me: () => Promise<any>;
        logout: () => Promise<any>;
      };
      agent?: {
        register: (payload: { editorName: string; groupCode?: string }) => Promise<any>;
      };
      ui?: {
        pickFolder: () => Promise<{ ok: boolean; canceled: boolean; path: string | null }>;
        triggerAttentionTest?: (payload?: { reason?: string }) => Promise<any>;
        toggleMainWindow?: () => Promise<any>;
        openAttentionFromBubble?: () => Promise<any>;
        toast?: (payload: { kind: string; title: string; message?: string }) => Promise<any>;
      };
      config?: {
        getWatchedFolders: () => Promise<string[]>;
        setWatchedFolders: (payload: { folders: string[] }) => Promise<any>;
        get: () => Promise<any>;
        setMinimizeToTray: (payload: { minimizeToTray: boolean }) => Promise<any>;
        setUpdateUrl: (payload: { updateUrl: string }) => Promise<any>;
      };
      attention?: {
        decision: (payload: { reason: string; decision: string; details?: unknown }) => Promise<any>;
        dismiss?: () => Promise<any>;
      };
      sd?: {
        removalDecision: (payload: { decision: 'reinsert' | 'confirm_early_removal' }) => Promise<any>;
        bind: (payload: { hardwareId: string; cameraNumber: number; sdLabel: string; capacityBytes?: number }) => Promise<any>;
        getMounted: () => Promise<any>;
      };
      session?: {
        updateProgress: (payload: { filesCopied: number; filesPending: number }) => Promise<any>;
      };
      events?: {
        on: (channel: string, handler: (...args: any[]) => void) => () => void;
      };
      snapshot?: { get: (payload: { sessionId: string }) => Promise<any> };
      issues?: {
        list: () => Promise<any[]>;
        ack: (payload: { id: string }) => Promise<any>;
        clear: () => Promise<any>;
        report?: (payload: { severity: 'info' | 'warning' | 'error'; code?: string; message: string; data?: unknown }) => Promise<any>;
        onUpdated: (handler: (list: any[]) => void) => () => void;
      };
      media?: { getMetadata: (payload: { sessionId: string; relativePath: string }) => Promise<any> };
      backup?: {
        getConfig: () => Promise<any>;
        setConfig: (payload: { backupEnabled?: boolean; backupDestination?: string | null }) => Promise<any>;
        setDestinations: (payload: { destinations: string[] }) => Promise<any>;
        listDestinations: () => Promise<any[]>;
        start: (payload: { destRoot?: string }) => Promise<any>;
        getStatus: () => Promise<any>;
        getOverview?: () => Promise<any>;
        pause: () => Promise<any>;
        resume: () => Promise<any>;
        retryFailed: () => Promise<any>;
        bindDrive: (payload: { drivePath: string; driveLabel: string; driveSerial?: string }) => Promise<any>;
        listBoundDrives: () => Promise<any[]>;
        unbindDrive: (payload: { drivePath: string }) => Promise<any>;
        onProgress: (handler: (p: any) => void) => () => void;
        onStatus: (handler: (s: any) => void) => () => void;
        onFileError: (handler: (e: any) => void) => () => void;
        onComplete: (handler: (d: any) => void) => () => void;
        onError: (handler: (e: any) => void) => () => void;
      };
      copy?: {
        getState: () => Promise<any>;
        getSuggestedFolder: () => Promise<any>;
        createSdFolder: (payload: { folderPath: string }) => Promise<any>;
        onFileCopied: (handler: (d: any) => void) => () => void;
        onFileRenamed: (handler: (d: any) => void) => () => void;
      };
    };
  }
}

export {};
