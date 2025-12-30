import React, { useEffect, useState } from 'react';

type Props = {
  coreStatus: any;
  onSaved?: () => void;
};

export function SettingsPage(props: Props) {
  const api = window.gate1;
  const [folders, setFolders] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string>('');
  const [minimizeToTray, setMinimizeToTray] = useState<boolean>(props.coreStatus?.minimizeToTray ?? true);
  const [updateUrl, setUpdateUrl] = useState<string>(props.coreStatus?.updateUrl ?? '');

  const [backupDestinations, setBackupDestinations] = useState<string[]>(props.coreStatus?.backupDestinations ?? []);
  const [backupEnabled, setBackupEnabled] = useState<boolean>(!!props.coreStatus?.backupEnabled);
  const [primaryBackupDestination, setPrimaryBackupDestination] = useState<string>(props.coreStatus?.backupDestination ?? '');
  const [backupDestInput, setBackupDestInput] = useState<string>('');

  // Tools state
  const [sessionId, setSessionId] = useState('');
  const [rel, setRel] = useState('');
  const [files, setFiles] = useState<string[]>([]);
  const [toolsOut, setToolsOut] = useState<any>(null);
  const [toolsStatus, setToolsStatus] = useState('-');

  // Section visibility
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showTools, setShowTools] = useState(false);

  const load = async () => {
    try {
      if (api?.config?.getWatchedFolders) {
        const f = await api.config.getWatchedFolders();
        setFolders(Array.isArray(f) ? f : []);
      }

      if (api?.core?.getStatus) {
        const st = await api.core.getStatus();
        setMinimizeToTray(st?.minimizeToTray ?? true);
        setUpdateUrl(st?.updateUrl ?? '');
        setBackupDestinations(Array.isArray(st?.backupDestinations) ? st.backupDestinations : []);
        setBackupEnabled(!!st?.backupEnabled);
        setPrimaryBackupDestination(st?.backupDestination ?? '');
        if (st?.activeSession?.sessionId) setSessionId(st.activeSession.sessionId);
      }
    } catch (e: any) {
      setMsg(e?.message ?? 'Failed to load settings');
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const addFolder = async () => {
    if (!api?.ui?.pickFolder) return;
    const res = await api.ui.pickFolder();
    if (!res || res.canceled || !res.path) return;
    const next = Array.from(new Set([...folders, res.path]));
    setFolders(next);
  };

  const removeFolder = (p: string) => {
    setFolders(folders.filter((x) => x !== p));
  };

  const save = async () => {
    setSaving(true);
    setMsg('');
    try {
      if (api?.config?.setWatchedFolders) {
        await api.config.setWatchedFolders({ folders });
      }

      if (api?.config?.setMinimizeToTray) {
        await api.config.setMinimizeToTray({ minimizeToTray });
      }

      if (api?.config?.setUpdateUrl) {
        await api.config.setUpdateUrl({ updateUrl });
      }

      if (api?.backup?.setDestinations) {
        await api.backup.setDestinations({ destinations: backupDestinations });
      }

      if (api?.backup?.setConfig) {
        await api.backup.setConfig({
          backupEnabled,
          backupDestination: primaryBackupDestination.trim().length ? primaryBackupDestination.trim() : null,
        });
      }

      setMsg('Saved');
      await api?.ui?.toast?.({ kind: 'success', title: 'Settings saved' });
      props.onSaved?.();
    } catch (e: any) {
      setMsg(e?.message ?? 'Save failed');
      await api?.ui?.toast?.({ kind: 'error', title: 'Settings save failed', message: e?.message ?? 'unknown' });
    } finally {
      setSaving(false);
    }
  };

  const addBackupDest = () => {
    const p = backupDestInput.trim();
    if (!p) return;
    setBackupDestinations(Array.from(new Set([...backupDestinations, p])));
    setBackupDestInput('');
  };

  const removeBackupDest = (p: string) => {
    setBackupDestinations(backupDestinations.filter((x) => x !== p));
    if (primaryBackupDestination === p) setPrimaryBackupDestination('');
  };

  // Tools functions
  const refreshFiles = async () => {
    if (!api?.snapshot?.get) return;
    if (!sessionId) return;
    const snap = await api.snapshot.get({ sessionId });
    const f = Array.isArray(snap?.files) ? snap.files.map((x: any) => String(x.relativePath)) : [];
    setFiles(f);
  };

  const getMetadata = async () => {
    if (!api?.media?.getMetadata) return;
    if (!sessionId || !rel) { setToolsStatus('missing inputs'); return; }
    setToolsStatus('loading...');
    const r = await api.media.getMetadata({ sessionId, relativePath: rel });
    setToolsOut(r);
    setToolsStatus(r?.ok ? (r.cached ? 'ok (cached)' : 'ok') : (r?.reason ?? 'error'));
  };

  useEffect(() => {
    void refreshFiles();
  }, [sessionId]);

  return (
    <div className="page">
      {/* Main Settings */}
      <div className="card">
        <div className="cardHeader">
          <strong>Settings</strong>
          <button className="btn btnPrimary" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save All'}
          </button>
        </div>

        <div className="sectionTitle">Watched Folders</div>
        <div className="muted">Folders where you copy clips. Used for verification and wrong destination detection.</div>

        <div className="row" style={{ marginTop: 10 }}>
          <button className="btn" onClick={addFolder}>Add Folder</button>
          <button className="btn" onClick={load}>Reload</button>
          {msg ? <span className="muted">{msg}</span> : null}
        </div>

        <div className="list" style={{ marginTop: 10 }}>
          {folders.length === 0 ? <div className="muted">No watched folders configured.</div> : null}
          {folders.map((p) => (
            <div key={p} className="listRow">
              <div className="listMain">{p}</div>
              <button className="btn" onClick={() => removeFolder(p)}>Remove</button>
            </div>
          ))}
        </div>

        <div className="sectionTitle" style={{ marginTop: 20 }}>Backup</div>
        <div className="row" style={{ marginTop: 8 }}>
          <label className="row" style={{ gap: 6 }}>
            <input type="checkbox" checked={backupEnabled} onChange={(e) => setBackupEnabled(e.target.checked)} />
            <span>Enable automatic backup</span>
          </label>
        </div>

        <div className="muted" style={{ marginTop: 10 }}>Primary backup destination</div>
        <div className="row" style={{ marginTop: 6 }}>
          <input
            value={primaryBackupDestination}
            onChange={(e) => setPrimaryBackupDestination(e.target.value)}
            placeholder="/Volumes/BackupDrive/Gate1"
            style={{ flex: 1 }}
          />
        </div>

        <div className="muted" style={{ marginTop: 10 }}>Additional destinations</div>
        <div className="row" style={{ marginTop: 6 }}>
          <input
            value={backupDestInput}
            onChange={(e) => setBackupDestInput(e.target.value)}
            placeholder="/Volumes/Disk2/Gate1"
            style={{ flex: 1 }}
          />
          <button className="btn" onClick={addBackupDest}>Add</button>
        </div>

        <div className="list" style={{ marginTop: 8 }}>
          {backupDestinations.length === 0 ? <div className="muted">No additional destinations.</div> : null}
          {backupDestinations.map((p) => (
            <div key={p} className="listRow">
              <div className="listMain">{p}</div>
              <button className="btn" onClick={() => removeBackupDest(p)}>Remove</button>
            </div>
          ))}
        </div>
      </div>

      {/* Advanced Section */}
      <div className="card">
        <div 
          className="cardHeader" 
          style={{ cursor: 'pointer' }} 
          onClick={() => setShowAdvanced(!showAdvanced)}
        >
          <strong>Advanced</strong>
          <span className="pill pillNeutral">{showAdvanced ? '▼' : '▶'}</span>
        </div>

        {showAdvanced && (
          <>
            <div className="sectionTitle">Behavior</div>
            <div className="row" style={{ marginTop: 8 }}>
              <label className="row" style={{ gap: 6 }}>
                <input
                  type="checkbox"
                  checked={minimizeToTray}
                  onChange={(e) => setMinimizeToTray(e.target.checked)}
                />
                <span>Minimize to tray on close</span>
              </label>
            </div>

            <div className="sectionTitle" style={{ marginTop: 16 }}>Update URL</div>
            <div className="muted">Only change if instructed by support.</div>
            <div className="row" style={{ marginTop: 8 }}>
              <input
                value={updateUrl}
                onChange={(e) => setUpdateUrl(e.target.value)}
                placeholder="https://..."
                style={{ flex: 1 }}
              />
            </div>

            <div className="sectionTitle" style={{ marginTop: 16 }}>Diagnostics</div>
            <pre style={{ fontSize: 11 }}>{JSON.stringify({ 
              platform: props.coreStatus?.platform, 
              deviceId: props.coreStatus?.deviceId,
              agentId: props.coreStatus?.agentId,
              online: props.coreStatus?.online,
            }, null, 2)}</pre>
          </>
        )}
      </div>

      {/* Tools Section (Dev only) */}
      {import.meta.env.DEV && (
        <div className="card">
          <div 
            className="cardHeader" 
            style={{ cursor: 'pointer' }} 
            onClick={() => setShowTools(!showTools)}
          >
            <strong>Developer Tools</strong>
            <span className="pill pillBlue">{showTools ? '▼' : '▶'}</span>
          </div>

          {showTools && (
            <>
              <div className="sectionTitle">UI Testing</div>
              <div className="row" style={{ marginTop: 8 }}>
                <button
                  className="btn"
                  onClick={async () => {
                    await api?.ui?.triggerAttentionTest?.({ reason: 'TEST_ATTENTION_MODAL' });
                  }}
                  disabled={!api?.ui?.triggerAttentionTest}
                >
                  Test Attention Modal
                </button>
                <span className="muted">Triggers attention event for testing.</span>
              </div>

              <div className="sectionTitle" style={{ marginTop: 16 }}>Media Metadata</div>
              <div className="row" style={{ marginTop: 8 }}>
                <input 
                  value={sessionId} 
                  onChange={(e) => setSessionId(e.target.value)} 
                  placeholder="sessionId" 
                  style={{ flex: 1 }} 
                />
                <input 
                  value={rel} 
                  onChange={(e) => setRel(e.target.value)} 
                  placeholder="relativePath" 
                  style={{ flex: 2 }} 
                />
                <button className="btn" onClick={getMetadata}>Get</button>
                <span className="muted">{toolsStatus}</span>
              </div>

              <div className="row" style={{ marginTop: 8 }}>
                <select value={rel} onChange={(e) => setRel(e.target.value)} style={{ flex: 1 }}>
                  <option value="">(select snapshot file)</option>
                  {files.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
                <button className="btn" onClick={refreshFiles}>Refresh</button>
              </div>

              {toolsOut && <pre style={{ fontSize: 11 }}>{JSON.stringify(toolsOut, null, 2)}</pre>}
            </>
          )}
        </div>
      )}
    </div>
  );
}
