import React, { useEffect, useReducer, useState } from 'react';
import { BrandHero } from './components/BrandHero';
import { Tabs, type TabId } from './components/Tabs';
import { Banners } from './components/Banners';
import { Toasts } from './components/Toasts';
import type { ActivityItem, BannerItem, ToastItem } from './components/ui';
import { useUiEvents } from './components/useUiEvents';
import { AttentionModal, type AttentionPayload } from './components/AttentionModal';
import { SdBindingModal, type SdBindingPayload } from './components/SdBindingModal';
import { BackupDriveBindingModal, type BackupDrivePayload } from './components/BackupDriveBindingModal';

import { TodayPage } from './pages/TodayPage';
import { SessionsPage } from './pages/SessionsPage';
import { BackupPage } from './pages/BackupPage';
import { IssuesPage } from './pages/IssuesPage';
import { SettingsPage } from './pages/SettingsPage';
import { LoginPage } from './pages/LoginPage';

type UiState = {
  toasts: ToastItem[];
  banners: BannerItem[];
  activity: ActivityItem[];
};

type UiAction =
  | { type: 'toast:add'; toast: ToastItem }
  | { type: 'toast:remove'; id: string }
  | { type: 'banner:addOrReplace'; banner: BannerItem }
  | { type: 'banner:dismiss'; id: string }
  | { type: 'activity:add'; item: ActivityItem };

function uiReducer(state: UiState, action: UiAction): UiState {
  if (action.type === 'toast:add') {
    return { ...state, toasts: [action.toast, ...state.toasts].slice(0, 4) };
  }
  if (action.type === 'toast:remove') {
    return { ...state, toasts: state.toasts.filter((t) => t.id !== action.id) };
  }
  if (action.type === 'banner:addOrReplace') {
    const others = state.banners.filter((b) => b.id !== action.banner.id);
    return { ...state, banners: [action.banner, ...others].slice(0, 6) };
  }
  if (action.type === 'banner:dismiss') {
    return { ...state, banners: state.banners.filter((b) => b.id !== action.id) };
  }
  if (action.type === 'activity:add') {
    return { ...state, activity: [action.item, ...state.activity].slice(0, 60) };
  }
  return state;
}

export default function AppShell() {
  const api = window.gate1;
  const [tab, setTab] = useState<TabId>('today');
  const [coreStatus, setCoreStatus] = useState<any>(null);
  const [uiState, setUiState] = useState<any>(null);
  const [ui, dispatch] = useReducer(uiReducer, { toasts: [], banners: [], activity: [] });
  const [attentionOpen, setAttentionOpen] = useState(false);
  const [attentionPayload, setAttentionPayload] = useState<AttentionPayload | null>(null);

  const [bindingOpen, setBindingOpen] = useState(false);
  const [bindingPayload, setBindingPayload] = useState<SdBindingPayload | null>(null);

  const [backupBindingOpen, setBackupBindingOpen] = useState(false);
  const [backupBindingPayload, setBackupBindingPayload] = useState<BackupDrivePayload | null>(null);

  const [snapshotProgress, setSnapshotProgress] = useState<any>(null);
  const [snapshot, setSnapshot] = useState<any>(null);
  const [copyProgress, setCopyProgress] = useState<{ filesCopied?: number; filesPending?: number; filename?: string } | null>(null);

  useUiEvents(dispatch);

  useEffect(() => {
    if (!api?.events?.on) return;
    const unsubs: Array<() => void> = [];

    unsubs.push(
      api.events.on('ui:state', (d: any) => {
        setUiState(d);
      })
    );

    unsubs.push(
      api.events.on('attention:required', (d: any) => {
        setAttentionPayload({ reason: String(d?.reason ?? 'UNKNOWN'), data: d?.data ?? null });
        setAttentionOpen(true);
      })
    );

    unsubs.push(
      api.events.on('sd:needs-binding', (d: any) => {
        setBindingPayload({
          hardwareId: String(d?.hardwareId ?? ''),
          mountPath: String(d?.mountPath ?? ''),
          driveLetter: String(d?.driveLetter ?? ''),
          sessionId: d?.sessionId,
        });
        setBindingOpen(true);
      })
    );

    unsubs.push(
      api.events.on('snapshot:progress', (p: any) => {
        setSnapshotProgress(p);
      })
    );
    unsubs.push(
      api.events.on('snapshot:complete', (p: any) => {
        setSnapshotProgress({ ...(p ?? {}), status: 'complete' });
        setSnapshot(p); // Store the complete snapshot for CopyAssistant
      })
    );
    unsubs.push(
      api.events.on('snapshot:error', (e: any) => {
        setSnapshotProgress({ ...(e ?? {}), status: 'error' });
      })
    );

    unsubs.push(
      api.events.on('copy:file-copied', (d: any) => {
        setCopyProgress({
          filesCopied: d?.filesCopied,
          filesPending: d?.filesPending,
          filename: d?.filename,
        });
      })
    );

    unsubs.push(
      api.events.on('backup:needs-binding', (d: any) => {
        setBackupBindingPayload({
          drivePath: String(d?.drivePath ?? ''),
          driveLabel: String(d?.driveLabel ?? ''),
        });
        setBackupBindingOpen(true);
      })
    );

    return () => {
      try {
        for (const u of unsubs) u();
      } catch {
        // ignore
      }
    };
  }, [api]);

  const refreshCore = async () => {
    if (!api?.core?.getStatus) return;
    try {
      const st = await api.core.getStatus();
      setCoreStatus(st);

      if (st?.online === false) {
        dispatch({
          type: 'banner:addOrReplace',
          banner: {
            id: 'offline',
            kind: 'warning',
            title: 'Offline mode',
            message: 'Requests will be queued until connectivity returns.',
            sticky: true,
            createdAt: Date.now(),
          },
        });
      } else {
        dispatch({ type: 'banner:dismiss', id: 'offline' });
      }

      if (st?.platform !== 'win32') {
        dispatch({
          type: 'banner:addOrReplace',
          banner: {
            id: 'platform',
            kind: 'info',
            title: 'Windows-only features disabled',
            message: 'SD detection, snapshots, and session workflows are enabled on Windows only (for now).',
            sticky: true,
            createdAt: Date.now(),
          },
        });
      } else {
        dispatch({ type: 'banner:dismiss', id: 'platform' });
      }
    } catch (e: any) {
      setCoreStatus({ ok: false, error: e?.message ?? 'core_status_failed' });
    }
  };

  useEffect(() => {
    void refreshCore();
    const t = window.setInterval(() => void refreshCore(), 5000);
    return () => window.clearInterval(t);
  }, []);

  if (!api) {
    return (
      <div className="app">
        <div className="main">
          <div className="card">
            <div className="cardHeader">
              <strong>Gate 1 Agent v2</strong>
              <span className="muted">UI</span>
            </div>
            <div className="bannerInline">gate1 preload not available</div>
          </div>
        </div>
      </div>
    );
  }

  const activeSession = coreStatus?.activeSession ?? null;

  const needsLogin = !(coreStatus?.hasToken && coreStatus?.tokenExpired === false);
  const needsRegistration = !needsLogin && !coreStatus?.agentId;

  return (
    <div className="app">
      <BrandHero
        title="Gate 1"
        subtitle="Desktop Agent"
        online={typeof coreStatus?.online === 'boolean' ? coreStatus.online : null}
        platform={coreStatus?.platform ?? null}
        activeEvent={coreStatus?.activeEvent ?? null}
        attention={uiState?.state === 'ATTENTION_REQUIRED'}
        activeSession={activeSession ? {
          sessionId: activeSession.sessionId,
          eventId: activeSession.eventId ?? null,
          serverSessionId: activeSession.serverSessionId ?? null,
        } : null}
      />
      {!needsLogin && !needsRegistration ? <Tabs value={tab} onChange={setTab} /> : null}

      <div className="main">
        <Banners items={ui.banners} onDismiss={(id) => dispatch({ type: 'banner:dismiss', id })} />

        {needsLogin || needsRegistration ? (
          <LoginPage coreStatus={coreStatus} onDone={refreshCore} />
        ) : null}

        {!needsLogin && !needsRegistration && tab === 'today' ? (
          <TodayPage
            coreStatus={coreStatus}
            uiState={uiState}
            activity={ui.activity}
            snapshotProgress={snapshotProgress}
            copyProgress={copyProgress}
            snapshot={snapshot}
          />
        ) : null}
        {!needsLogin && !needsRegistration && tab === 'sessions' ? <SessionsPage coreStatus={coreStatus} /> : null}
        {!needsLogin && !needsRegistration && tab === 'backup' ? <BackupPage coreStatus={coreStatus} /> : null}
        {!needsLogin && !needsRegistration && tab === 'issues' ? <IssuesPage coreStatus={coreStatus} uiState={uiState} /> : null}
        {!needsLogin && !needsRegistration && tab === 'settings' ? <SettingsPage coreStatus={coreStatus} onSaved={refreshCore} /> : null}
      </div>

      <AttentionModal
        open={attentionOpen}
        payload={attentionPayload}
        onClose={() => {
          setAttentionOpen(false);
        }}
      />

      <SdBindingModal
        open={bindingOpen}
        payload={bindingPayload}
        onClose={() => {
          setBindingOpen(false);
        }}
        onBound={() => {
          void refreshCore();
        }}
      />

      <BackupDriveBindingModal
        open={backupBindingOpen}
        payload={backupBindingPayload}
        onClose={() => {
          setBackupBindingOpen(false);
        }}
        onBound={() => {
          void refreshCore();
        }}
      />

      <Toasts items={ui.toasts} />
    </div>
  );
}
