import React, { useEffect, useState } from 'react';

type BackupDestInfo = { path: string; exists: boolean; writable: boolean; reason?: string };

type Props = {
  coreStatus: any;
};

function fmtBytes(n: number | null | undefined) {
  const x = Number(n ?? 0);
  if (!Number.isFinite(x) || x <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let v = x;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function pct(n: any) {
  const x = Number(n);
  if (!Number.isFinite(x)) return null;
  return Math.max(0, Math.min(100, Math.round(x)));
}

export function BackupPage(_props: Props) {
  const api = window.gate1;
  const [status, setStatus] = useState<any>(null);
  const [overview, setOverview] = useState<any>(null);
  const [dests, setDests] = useState<BackupDestInfo[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [last, setLast] = useState<any>(null);

  const refresh = async () => {
    if (!api?.backup) return;
    setStatus(await api.backup.getStatus());
    setOverview(await api.backup.getOverview?.());
    const ds = await api.backup.listDestinations();
    setDests(ds);
    if (!selected) {
      const lastDest = overview?.last?.destRoot;
      const preferred = lastDest && ds.find((d: BackupDestInfo) => d.path === lastDest && d.exists && d.writable);
      const first = ds.find((d: BackupDestInfo) => d.exists && d.writable);
      if (preferred) setSelected(preferred.path);
      else if (first) setSelected(first.path);
    }
  };

  useEffect(() => {
    void refresh();
    if (!api?.backup) return;
    const unsubs: Array<() => void> = [];
    unsubs.push(api.backup.onStatus((s: any) => setStatus(s)));
    unsubs.push(api.backup.onProgress(() => void refresh()));
    return () => {
      for (const u of unsubs) {
        try { u(); } catch { /* ignore */ }
      }
    };
  }, []);

  const unavailableReason = !api?.backup
    ? 'backup API unavailable'
    : _props.coreStatus?.platform !== 'win32'
      ? 'Windows-only (SD + snapshot required)'
      : null;

  return (
    <div className="page">
      <div className="card">
        <div className="cardHeader">
          <strong>Backup</strong>
          <span className="muted">operational</span>
        </div>

        {unavailableReason ? <div className="bannerInline">{unavailableReason}</div> : null}

        <div className="sectionTitle" style={{ marginTop: 12 }}>Overview</div>
        <div className="list" style={{ marginTop: 8 }}>
          <div className="listRow">
            <div className="listMain">
              <strong>Last backup</strong>
              <div className="muted" style={{ marginTop: 4 }}>
                {overview?.last ? `Disk: ${String(overview.last.diskLabel ?? '-')}` : 'No backups recorded yet.'}
              </div>
              {overview?.last ? (
                <div className="muted" style={{ marginTop: 4 }}>
                  Folder: {String(overview.last.destRoot ?? '-')}
                </div>
              ) : null}
              {overview?.last ? (
                <div className="muted" style={{ marginTop: 4 }}>
                  Verified: {String(overview.last.completedFiles ?? 0)}/{String(overview.last.totalFiles ?? 0)} (failed: {String(overview.last.failedFiles ?? 0)})
                </div>
              ) : null}
              {overview?.last ? (
                <div className="muted" style={{ marginTop: 4 }}>
                  Size: {fmtBytes(overview.last.copiedBytes)} / {fmtBytes(overview.last.totalBytes)}
                </div>
              ) : null}
            </div>
          </div>

          <div className="listRow">
            <div className="listMain">
              <strong>Remaining for this session</strong>
              <div className="muted" style={{ marginTop: 4 }}>
                Clips remaining: {String(overview?.remaining?.remainingFiles ?? '-')}
              </div>
              <div className="muted" style={{ marginTop: 4 }}>
                Size remaining: {overview?.remaining?.remainingBytes != null ? fmtBytes(overview.remaining.remainingBytes) : '-'}
              </div>
            </div>
          </div>

          <div className="listRow">
            <div className="listMain">
              <strong>Backup completeness</strong>
              <div className="muted" style={{ marginTop: 4 }}>
                {pct(overview?.completion?.percent) != null ? `${pct(overview?.completion?.percent)}% complete` : '—'}
              </div>
              {pct(overview?.completion?.percent) != null ? (
                <div style={{ marginTop: 8, height: 10, background: 'rgba(0,0,0,0.08)', borderRadius: 999, overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${pct(overview?.completion?.percent)}%`,
                      height: '100%',
                      background: pct(overview?.completion?.percent) === 100 ? 'rgba(34,197,94,0.85)' : 'rgba(168,85,247,0.75)',
                    }}
                  />
                </div>
              ) : null}
              <div className="muted" style={{ marginTop: 8 }}>
                Verified (same name): {String(overview?.completion?.matchedNormal ?? '-')}
              </div>
              <div className="muted" style={{ marginTop: 4 }}>
                Verified (renamed): {String(overview?.completion?.matchedRenamed ?? '-')}
              </div>
              <div className="muted" style={{ marginTop: 4 }}>
                Pending: {String(overview?.completion?.pendingCount ?? '-')}
              </div>
            </div>
          </div>
        </div>

        {Array.isArray(overview?.completion?.pendingDetails) && overview.completion.pendingDetails.length > 0 ? (
          <>
            <div className="sectionTitle" style={{ marginTop: 16 }}>Pending clips</div>
            <div className="muted">Showing up to {overview.completion.pendingDetails.length} examples.</div>
            <div className="list" style={{ marginTop: 8 }}>
              {overview.completion.pendingDetails.map((p: any) => (
                <div key={String(p.relativePath)} className="listRow">
                  <div className="listMain">
                    <strong>{String(p.name ?? p.relativePath)}</strong>
                    <div className="muted" style={{ marginTop: 4 }}>{String(p.relativePath)}</div>
                  </div>
                  <div className="muted">{fmtBytes(p.sizeBytes)}</div>
                </div>
              ))}
            </div>
          </>
        ) : null}

        <div className="sectionTitle" style={{ marginTop: 16 }}>Actions</div>
        <div className="row" style={{ marginTop: 8, gap: 8, flexWrap: 'wrap' }}>
          <button
            className="btn"
            onClick={async () => {
              const payload = selected ? { destRoot: selected } : {};
              setLast(await api?.backup?.start(payload as any));
              await refresh();
            }}
            disabled={!!unavailableReason}
          >
            Start backup
          </button>
          <button className="btn" onClick={refresh}>Refresh</button>
          <button className="btn" onClick={async () => { setLast(await api?.backup?.pause()); await refresh(); }} disabled={!!unavailableReason}>Pause</button>
          <button className="btn" onClick={async () => { setLast(await api?.backup?.resume()); await refresh(); }} disabled={!!unavailableReason}>Resume</button>
          <button className="btn" onClick={async () => { setLast(await api?.backup?.retryFailed()); await refresh(); }} disabled={!!unavailableReason}>Retry Failed</button>
        </div>

        {import.meta.env.DEV ? (
          <>
            <div className="sectionTitle" style={{ marginTop: 16 }}>Backup disk (dev only)</div>
            <div className="muted">Override only for testing / switching disks.</div>
            <div className="row" style={{ marginTop: 8 }}>
              <select value={selected} onChange={(e) => setSelected(e.target.value)} style={{ flex: 1, minWidth: 260 }}>
                <option value="">(auto)</option>
                {dests.map((d) => (
                  <option key={d.path} value={d.path} disabled={!d.exists || !d.writable}>
                    {d.path}{d.exists ? '' : ' (missing)'}{d.exists && !d.writable ? ' (read-only)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </>
        ) : null}

        {last ? (
          <div style={{ marginTop: 12 }}>
            <div className="sectionTitle">Last action</div>
            <div className="muted" style={{ marginTop: 6 }}>{JSON.stringify(last)}</div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
