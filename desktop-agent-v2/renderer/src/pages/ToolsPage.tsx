import React, { useEffect, useState } from 'react';

export function ToolsPage() {
  const api = window.gate1;
  const [sessionId, setSessionId] = useState('');
  const [rel, setRel] = useState('');
  const [files, setFiles] = useState<string[]>([]);
  const [out, setOut] = useState<any>(null);
  const [status, setStatus] = useState('-');

  const refreshFiles = async () => {
    if (!api?.snapshot?.get) return;
    if (!sessionId) return;
    const snap = await api.snapshot.get({ sessionId });
    const f = Array.isArray(snap?.files) ? snap.files.map((x: any) => String(x.relativePath)) : [];
    setFiles(f);
  };

  const get = async () => {
    if (!api?.media?.getMetadata) return;
    if (!sessionId || !rel) { setStatus('missing inputs'); return; }
    setStatus('loading...');
    const r = await api.media.getMetadata({ sessionId, relativePath: rel });
    setOut(r);
    setStatus(r?.ok ? (r.cached ? 'ok (cached)' : 'ok') : (r?.reason ?? 'error'));
  };

  useEffect(() => {
    (async () => {
      try {
        const st = await api?.core?.getStatus?.();
        if (st?.activeSession?.sessionId) setSessionId(st.activeSession.sessionId);
      } catch {
        // ignore
      }
    })();
  }, []);

  useEffect(() => {
    void refreshFiles();
  }, [sessionId]);

  return (
    <div className="page">
      <div className="card">
        <div className="cardHeader">
          <strong>Tools</strong>
          <span className="muted">debug utilities</span>
        </div>

        <div className="sectionTitle">UI testing</div>
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
          <span className="muted">Triggers an attention event without requiring SD workflows.</span>
        </div>

        <div className="sectionTitle">Media metadata</div>
        <div className="row" style={{ marginTop: 8 }}>
          <input value={sessionId} onChange={(e) => setSessionId(e.target.value)} placeholder="sessionId" style={{ flex: 1, minWidth: 220 }} />
          <input value={rel} onChange={(e) => setRel(e.target.value)} placeholder="relativePath" style={{ flex: 2, minWidth: 260 }} />
          <button className="btn" onClick={get}>Get</button>
          <span className="muted">{status}</span>
        </div>

        <div className="row" style={{ marginTop: 8 }}>
          <select value={rel} onChange={(e) => setRel(e.target.value)} style={{ flex: 1, minWidth: 320 }}>
            <option value="">(select snapshot file)</option>
            {files.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <button className="btn" onClick={refreshFiles}>Refresh Files</button>
        </div>

        <pre>{JSON.stringify(out, null, 2)}</pre>
      </div>
    </div>
  );
}
