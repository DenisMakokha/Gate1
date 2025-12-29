import Store from 'electron-store';
import { DEFAULT_API_URL } from './constants';

export type Gate1Config = {
  apiUrl: string;
  updateUrl?: string;
  autoStart?: boolean;
  minimizeToTray?: boolean;
  watchedFolders?: string[];
  backupEnabled?: boolean;
  backupDestination?: string | null;
  backupDestinations?: string[];
};

export type Gate1LocalState = {
  deviceId?: string;
  agentId?: string;
  config: Gate1Config;
  agentConfig?: unknown;
  activeSdSession?: unknown;
  eventPolicyCipher?: string;
  activeEventId?: number | null;
  activeEventName?: string | null;
  activeEventFetchedAtIso?: string | null;
  lastKnownActiveEventId?: number | null;
  lastKnownActiveEventAtIso?: string | null;
  lastBackupSummary?: unknown;
};

export const store = new Store<Gate1LocalState>({
  name: 'gate1-agent-v2',
  defaults: {
    config: {
      apiUrl: DEFAULT_API_URL,
      updateUrl: DEFAULT_API_URL,
      autoStart: true,
      minimizeToTray: true,
      watchedFolders: [],
      backupEnabled: false,
      backupDestination: null,
      backupDestinations: [],
    },
  },
});
