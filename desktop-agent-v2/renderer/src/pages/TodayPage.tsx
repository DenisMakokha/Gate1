import React, { useEffect, useMemo, useState } from 'react';
import { ActivityFeed } from '../components/ActivityFeed';
import { CopyAssistant } from '../components/CopyAssistant';
import type { ActivityItem } from '../components/ui';

type Props = {
  coreStatus: any;
  uiState?: any;
  activity: ActivityItem[];
  snapshotProgress?: any;
  copyProgress?: { filesCopied?: number; filesPending?: number; filename?: string } | null;
  snapshot?: any;
};

export function TodayPage(props: Props) {
  const s = props.coreStatus;
  const st = props.uiState?.state as string | undefined;
  const ctx = props.uiState?.context ?? null;
  const active = s?.activeSession ?? null;

  const online = typeof s?.online === 'boolean' ? s.online : null;
  const queue = s?.offlineQueueSize;

  // Track copied and renamed files for CopyAssistant
  const [copiedFiles, setCopiedFiles] = useState<Set<string>>(new Set());
  const [renamedFiles, setRenamedFiles] = useState<Map<string, string>>(new Map());
  const [copyState, setCopyState] = useState<any>(null);

  // Load copy state and listen for updates
  useEffect(() => {
    const api = window.gate1;
    
    const loadCopyState = async () => {
      if (api?.copy?.getState) {
        const state = await api.copy.getState();
        if (state) {
          setCopyState(state);
          setCopiedFiles(new Set(state.copiedFiles || []));
          setRenamedFiles(new Map(Object.entries(state.renamedFiles || {})));
        }
      }
    };

    void loadCopyState();

    // Listen for copy events
    const unsubCopied = api?.copy?.onFileCopied?.((d: any) => {
      if (d?.filename) {
        setCopiedFiles(prev => new Set([...prev, d.filename]));
      }
    });

    const unsubRenamed = api?.copy?.onFileRenamed?.((d: any) => {
      if (d?.oldName && d?.newName) {
        setRenamedFiles(prev => new Map([...prev, [d.oldName, d.newName]]));
      }
    });

    return () => {
      unsubCopied?.();
      unsubRenamed?.();
    };
  }, [active?.sessionId]);

  const headline = (() => {
    if (st === 'ATTENTION_REQUIRED') return 'Attention needed';
    if (st === 'SD_DETECTED') return 'SD detected';
    if (st === 'COPYING_IN_PROGRESS') return 'Copying in progress';
    if (st === 'BACKUP_IN_PROGRESS') return 'Backup in progress';
    if (st === 'SD_REMOVAL_CHECK') return 'Checking SD before removal';
    if (st === 'EARLY_REMOVAL_CONFIRMED') return 'SD removed early';
    if (st === 'SESSION_CLOSED') return 'Session complete';
    return 'Gate 1 Agent is running';
  })();

  const subline = (() => {
    if (st === 'IDLE') return 'Insert an SD card to begin.';
    if (st === 'SD_DETECTED') return 'Preparing session…';
    if (st === 'SESSION_ACTIVE') return 'Session active. You may copy files, rename, or report issues.';
    if (st === 'COPYING_IN_PROGRESS') return 'Files are being verified.';
    if (st === 'BACKUP_IN_PROGRESS') return 'Backup is running in the background.';
    if (st === 'RETENTION_PENDING') return 'Files will be deleted automatically. No action required.';
    return '';
  })();

  const canReportIssue = !!window.gate1?.issues?.report;
  const canBackup = !!window.gate1?.backup?.start;
  const backupReady = !!ctx?.backupReady;
  const backupDisk = ctx?.recommendedBackupDisk ? String(ctx.recommendedBackupDisk) : null;

  const issuePromptClip = ctx?.issuePrompt?.clipName ? String(ctx.issuePrompt.clipName) : '';
  const issuePromptPath = ctx?.issuePrompt?.clipPath ? String(ctx.issuePrompt.clipPath) : '';

  const issueOptions = useMemo(
    () => [
      { code: 'VIDEO_CORRUPT', label: 'Video corrupt / won’t play' },
      { code: 'AUDIO_MISSING', label: 'No audio / bad audio' },
      { code: 'FOCUS_EXPOSURE', label: 'Focus / exposure issue' },
      { code: 'SHAKY', label: 'Shaky / unusable' },
      { code: 'WRONG_CLIP', label: 'Wrong clip / wrong card' },
      { code: 'OTHER', label: 'Other…' },
    ],
    []
  );

  const [issuePick, setIssuePick] = useState<string>('');
  const [issueOther, setIssueOther] = useState<string>('');

  return (
    <div className="page">
      <div className="card">
        <div className="cardHeader">
          <strong>{headline}</strong>
          <span className="muted">operational</span>
        </div>
        <div className="muted" style={{ marginTop: 6 }}>{subline}</div>

        <div className="grid2" style={{ marginTop: 12 }}>
          <div className="kpi">
            <div className="kpiLabel">Status</div>
            <div className="kpiValue">{online === null ? '-' : (online ? 'Online' : 'Offline')}</div>
            <div className="muted" style={{ marginTop: 6 }}>Queue: {queue ?? '-'}</div>
          </div>
          <div className="kpi">
            <div className="kpiLabel">Session</div>
            <div className="kpiValue">{active?.sessionId ? 'Active' : '—'}</div>
            <div className="muted" style={{ marginTop: 6 }}>
              {active?.sessionId ? `ID: ${active.sessionId}` : 'Insert an SD to begin'}
            </div>
          </div>
        </div>

        <div className="row" style={{ marginTop: 12, gap: 8, flexWrap: 'wrap' }}>
          {canReportIssue ? (
            <>
              <select
                value={issuePick}
                onChange={async (e) => {
                  const v = e.target.value;
                  setIssuePick(v);
                  if (!v) return;
                  if (v === 'OTHER') return;

                  try {
                    const picked = issueOptions.find((x) => x.code === v);
                    const clipLabel = issuePromptClip ? ` (Clip: ${issuePromptClip})` : '';
                    const message = `${picked?.label ?? v}${clipLabel}`;
                    await window.gate1?.issues?.report?.({
                      severity: 'warning',
                      code: v,
                      message,
                      data: issuePromptPath ? { clipPath: issuePromptPath, clipName: issuePromptClip || undefined } : undefined,
                    });
                    await window.gate1?.ui?.toast?.({ kind: 'success', title: 'Issue recorded', message: 'Saved for QA review.' });
                    setIssuePick('');
                  } catch (err: any) {
                    await window.gate1?.ui?.toast?.({ kind: 'error', title: 'Issue failed', message: err?.message ?? 'unknown' });
                  }
                }}
              >
                <option value="">Report an issue…</option>
                {issueOptions.map((o) => (
                  <option key={o.code} value={o.code}>{o.label}</option>
                ))}
              </select>
            </>
          ) : null}

          {canReportIssue && issuePick === 'OTHER' ? (
            <>
              <input
                value={issueOther}
                onChange={(e) => setIssueOther(e.target.value)}
                placeholder={issuePromptClip ? `What’s wrong with ${issuePromptClip}?` : 'What’s the issue?'}
                style={{ minWidth: 260, flex: 1 }}
              />
              <button
                className="btn"
                onClick={async () => {
                  const msg = issueOther.trim();
                  if (!msg) {
                    await window.gate1?.ui?.toast?.({ kind: 'warning', title: 'Missing details', message: 'Please type the issue.' });
                    return;
                  }
                  try {
                    const clipLabel = issuePromptClip ? ` (Clip: ${issuePromptClip})` : '';
                    await window.gate1?.issues?.report?.({
                      severity: 'warning',
                      code: 'OTHER',
                      message: `${msg}${clipLabel}`,
                      data: issuePromptPath ? { clipPath: issuePromptPath, clipName: issuePromptClip || undefined } : undefined,
                    });
                    await window.gate1?.ui?.toast?.({ kind: 'success', title: 'Issue recorded', message: 'Saved for QA review.' });
                    setIssueOther('');
                    setIssuePick('');
                  } catch (err: any) {
                    await window.gate1?.ui?.toast?.({ kind: 'error', title: 'Issue failed', message: err?.message ?? 'unknown' });
                  }
                }}
              >
                Send
              </button>
            </>
          ) : null}

          {canBackup && backupReady ? (
            <button
              className="btn"
              onClick={async () => {
                await window.gate1?.backup?.start({});
              }}
            >
              Start backup{backupDisk ? ` (${backupDisk})` : ''}
            </button>
          ) : null}

          {st === 'ATTENTION_REQUIRED' ? (
            <button className="btn" onClick={() => window.gate1?.ui?.toggleMainWindow?.()}>Review now</button>
          ) : null}
        </div>
      </div>

      {/* Copy Assistant - shows clips from snapshot and copy progress */}
      {(active?.sessionId || props.snapshot) && (
        <CopyAssistant
          snapshot={props.snapshot}
          binding={active?.binding ?? null}
          copyProgress={props.copyProgress ?? null}
          copiedFiles={copiedFiles}
          renamedFiles={renamedFiles}
        />
      )}

      <ActivityFeed items={props.activity} />
    </div>
  );
}
