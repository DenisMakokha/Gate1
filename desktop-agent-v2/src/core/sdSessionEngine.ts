import { EventEmitter } from 'events';

export type SdBinding = {
  sdCardId: number;
  cameraNumber: number;
  sdLabel: string;
  displayLabel?: string;
};

export type ActiveSdSession = {
  sessionId: string; // local-only for now
  sdHardwareId: string;
  mountPath: string;
  driveLetter: string;
  startedAtIso: string;
  binding?: SdBinding;
  serverSessionId?: string;
  eventId?: number;
  serverSessionStatus?: 'not_started' | 'queued_offline' | 'started';
  status: 'active' | 'removed';
  removedAtIso?: string;
};

export type SdSessionEngineDeps = {
  load: () => ActiveSdSession | null;
  save: (session: ActiveSdSession | null) => void;
  nowIso?: () => string;
  makeSessionId?: (hardwareId: string) => string;
};

export class SdSessionEngine extends EventEmitter {
  private deps: Required<SdSessionEngineDeps>;
  private active: ActiveSdSession | null;

  constructor(deps: SdSessionEngineDeps) {
    super();
    this.deps = {
      nowIso: deps.nowIso ?? (() => new Date().toISOString()),
      makeSessionId: deps.makeSessionId ?? ((hw) => `LOCAL-${hw}-${Date.now()}`),
      ...deps,
    } as Required<SdSessionEngineDeps>;

    this.active = this.deps.load();
    if (this.active?.status === 'active') {
      this.emit('session-restored', this.active);
    }
  }

  getActive(): ActiveSdSession | null {
    return this.active;
  }

  /**
   * Handles SD insertion with reinsertion/cleanup semantics:
   * - If a removed session exists for the same SD, resume it.
   * - If a removed session exists for a different SD, clear it and start a new session.
   * - If an active session exists for a different SD, block overlap.
   */
  onSdInserted(params: { sdHardwareId: string; mountPath: string; driveLetter: string }): ActiveSdSession {
    const cur = this.active;

    if (cur && cur.status === 'active') {
      if (cur.sdHardwareId !== params.sdHardwareId) {
        this.emit('session-overlap-blocked', { existing: cur, incoming: params });
        return cur;
      }
      // same SD already active (idempotent)
      return cur;
    }

    if (cur && cur.status === 'removed') {
      if (cur.sdHardwareId === params.sdHardwareId) {
        cur.status = 'active';
        cur.removedAtIso = undefined;
        cur.mountPath = params.mountPath;
        cur.driveLetter = params.driveLetter;
        this.deps.save(cur);
        this.emit('session-resumed', cur);
        return cur;
      }

      // removed session for another SD: clear it before starting a new one
      const cleared = cur;
      this.active = null;
      this.deps.save(null);
      this.emit('session-cleared', cleared);
    }

    return this.startIfNone(params);
  }

  startIfNone(params: { sdHardwareId: string; mountPath: string; driveLetter: string }): ActiveSdSession {
    if (this.active && this.active.status === 'active') {
      // one active session only
      if (this.active.sdHardwareId !== params.sdHardwareId) {
        this.emit('session-overlap-blocked', {
          existing: this.active,
          incoming: params,
        });
      }
      return this.active;
    }

    const session: ActiveSdSession = {
      sessionId: this.deps.makeSessionId(params.sdHardwareId),
      sdHardwareId: params.sdHardwareId,
      mountPath: params.mountPath,
      driveLetter: params.driveLetter,
      startedAtIso: this.deps.nowIso(),
      status: 'active',
    };

    this.active = session;
    this.deps.save(session);
    this.emit('session-started', session);
    return session;
  }

  setBinding(binding: SdBinding): void {
    if (!this.active || this.active.status !== 'active') return;
    this.active.binding = binding;
    this.deps.save(this.active);
    this.emit('session-binding-updated', this.active);
  }

  setServerSessionInfo(params: { serverSessionId: string; eventId: number }): void {
    if (!this.active || this.active.status !== 'active') return;
    this.active.serverSessionId = params.serverSessionId;
    this.active.eventId = params.eventId;
    this.active.serverSessionStatus = 'started';
    this.deps.save(this.active);
    this.emit('session-server-started', this.active);
  }

  setServerSessionQueued(eventId: number): void {
    if (!this.active || this.active.status !== 'active') return;
    this.active.eventId = eventId;
    this.active.serverSessionStatus = 'queued_offline';
    this.deps.save(this.active);
    this.emit('session-server-queued', this.active);
  }

  markRemoved(sdHardwareId: string): ActiveSdSession | null {
    if (!this.active || this.active.status !== 'active') return null;
    if (this.active.sdHardwareId !== sdHardwareId) return null;

    this.active.status = 'removed';
    this.active.removedAtIso = this.deps.nowIso();
    this.deps.save(this.active);
    this.emit('session-ended', this.active);
    return this.active;
  }

  clear(): void {
    this.active = null;
    this.deps.save(null);
  }
}
