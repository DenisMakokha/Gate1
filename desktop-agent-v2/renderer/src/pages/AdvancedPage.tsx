import React, { useEffect, useState } from 'react';

type Props = {
  coreStatus: any;
  onSaved?: () => void;
};

export function AdvancedPage(props: Props) {
  const api = window.gate1;

  const [minimizeToTray, setMinimizeToTray] = useState<boolean>(props.coreStatus?.minimizeToTray ?? true);
  const [updateUrl, setUpdateUrl] = useState<string>(props.coreStatus?.updateUrl ?? '');

  const [backupDestinations, setBackupDestinations] = useState<string[]>(props.coreStatus?.backupDestinations ?? []);
  const [backupEnabled, setBackupEnabled] = useState<boolean>(!!props.coreStatus?.backupEnabled);
  const [primaryBackupDestination, setPrimaryBackupDestination] = useState<string>(props.coreStatus?.backupDestination ?? '');
  const [backupDestInput, setBackupDestInput] = useState<string>('');

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string>('');

  const load = async () => {
    try {
      if (api?.core?.getStatus) {
        const st = await api.core.getStatus();
        setMinimizeToTray(st?.minimizeToTray ?? true);
        setUpdateUrl(st?.updateUrl ?? '');
        setBackupDestinations(Array.isArray(st?.backupDestinations) ? st.backupDestinations : []);
        setBackupEnabled(!!st?.backupEnabled);
        setPrimaryBackupDestination(st?.backupDestination ?? '');
      }
    } catch (e: any) {
      setMsg(e?.message ?? 'Failed to load advanced settings');
    }
  };

  useEffect(() => {
    void load();
  }, []);

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

  const save = async () => {
    setSaving(true);
    setMsg('');
    try {
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
      await api?.ui?.toast?.({ kind: 'success', title: 'Advanced settings saved' });
      props.onSaved?.();
    } catch (e: any) {
      setMsg(e?.message ?? 'Save failed');
      await api?.ui?.toast?.({ kind: 'error', title: 'Advanced save failed', message: e?.message ?? 'unknown' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page">
      <div className="card">
        <div className="cardHeader">
          <strong>Advanced</strong>
          <span className="muted">settings & tools</span>
        </div>

        <div className="sectionTitle" style={{ marginTop: 16 }}>Behavior</div>
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
        <div className="muted">Defaults to the current API URL. Only change if instructed.</div>
        <div className="row" style={{ marginTop: 8 }}>
          <input
            value={updateUrl}
            onChange={(e) => setUpdateUrl(e.target.value)}
            placeholder="https://..."
            style={{ flex: 1, minWidth: 320 }}
          />
        </div>

        <div className="sectionTitle" style={{ marginTop: 16 }}>Backup configuration</div>
        <div className="row" style={{ marginTop: 8 }}>
          <label className="row" style={{ gap: 6 }}>
            <input type="checkbox" checked={backupEnabled} onChange={(e) => setBackupEnabled(e.target.checked)} />
            <span>Enable backup</span>
          </label>
        </div>

        <div className="muted" style={{ marginTop: 8 }}>Primary destination (optional)</div>
        <div className="row" style={{ marginTop: 8 }}>
          <input
            value={primaryBackupDestination}
            onChange={(e) => setPrimaryBackupDestination(e.target.value)}
            placeholder="/Volumes/BackupDrive/Gate1"
            style={{ flex: 1, minWidth: 320 }}
          />
        </div>

        <div className="muted" style={{ marginTop: 8 }}>Additional destinations</div>
        <div className="row" style={{ marginTop: 8 }}>
          <input
            value={backupDestInput}
            onChange={(e) => setBackupDestInput(e.target.value)}
            placeholder="/Volumes/Disk2/Gate1"
            style={{ flex: 1, minWidth: 320 }}
          />
          <button className="btn" onClick={addBackupDest}>Add</button>
        </div>

        <div className="list" style={{ marginTop: 8 }}>
          {backupDestinations.length === 0 ? <div className="muted">No backup destinations configured.</div> : null}
          {backupDestinations.map((p) => (
            <div key={p} className="listRow">
              <div className="listMain">{p}</div>
              <button className="btn" onClick={() => removeBackupDest(p)}>Remove</button>
            </div>
          ))}
        </div>

        <div className="sectionTitle" style={{ marginTop: 16 }}>Actions</div>
        <div className="row" style={{ marginTop: 8, gap: 8, flexWrap: 'wrap' }}>
          <button className="btn" onClick={load}>Reload</button>
          <button className="btn" onClick={save} disabled={saving}>Save</button>
          {msg ? <span className="muted">{msg}</span> : null}
        </div>

        <div className="sectionTitle" style={{ marginTop: 16 }}>Diagnostics</div>
        <pre>{JSON.stringify({ platform: props.coreStatus?.platform, deviceId: props.coreStatus?.deviceId }, null, 2)}</pre>
      </div>
    </div>
  );
}
