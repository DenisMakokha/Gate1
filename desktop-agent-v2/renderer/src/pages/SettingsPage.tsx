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

  const load = async () => {
    try {
      if (api?.config?.getWatchedFolders) {
        const f = await api.config.getWatchedFolders();
        setFolders(Array.isArray(f) ? f : []);
      }

      if (import.meta.env.DEV && api?.core?.getStatus) {
        const st = await api.core.getStatus();
        setMinimizeToTray(st?.minimizeToTray ?? true);
        setUpdateUrl(st?.updateUrl ?? '');
        setBackupDestinations(Array.isArray(st?.backupDestinations) ? st.backupDestinations : []);
        setBackupEnabled(!!st?.backupEnabled);
        setPrimaryBackupDestination(st?.backupDestination ?? '');
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

      // Keep editors operational-first: only watched folders are configurable in production UI.
      if (import.meta.env.DEV) {
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

  return (
    <div className="page">
      <div className="card">
        <div className="cardHeader">
          <strong>Settings</strong>
          <span className="muted">configuration</span>
        </div>

        <div className="sectionTitle">Watched folders</div>
        <div className="muted">Used for copy observation + wrong destination detection.</div>

        <div className="row" style={{ marginTop: 8 }}>
          <button className="btn" onClick={addFolder}>Add folder</button>
          <button className="btn" onClick={load}>Reload</button>
          <button className="btn" onClick={save} disabled={saving}>Save</button>
          {msg ? <span className="muted">{msg}</span> : null}
        </div>

        <div className="list" style={{ marginTop: 8 }}>
          {folders.length === 0 ? <div className="muted">No watched folders configured.</div> : null}
          {folders.map((p) => (
            <div key={p} className="listRow">
              <div className="listMain">{p}</div>
              <button className="btn" onClick={() => removeFolder(p)}>Remove</button>
            </div>
          ))}
        </div>

        <div className="sectionTitle" style={{ marginTop: 16 }}>Diagnostics</div>
        <pre>{JSON.stringify({ platform: props.coreStatus?.platform, deviceId: props.coreStatus?.deviceId }, null, 2)}</pre>
      </div>
    </div>
  );
}
