import React, { useEffect, useState } from 'react';

type Issue = {
  id: string;
  createdAtIso: string;
  severity: 'info' | 'warning' | 'error';
  code: string;
  message: string;
  data?: any;
  acknowledged: boolean;
  acknowledgedAtIso?: string;
};

function fmtEat(iso: string | undefined) {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${new Intl.DateTimeFormat('en-KE', {
    timeZone: 'Africa/Nairobi',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d)} EAT`;
}

export function IssuesPage() {
  const api = window.gate1;
  const [issues, setIssues] = useState<Issue[]>([]);

  const refresh = async () => {
    if (!api?.issues) return;
    setIssues(await api.issues.list());
  };

  useEffect(() => {
    void refresh();
    if (!api?.issues) return;
    const u = api.issues.onUpdated((list: any[]) => setIssues(list as any));
    return () => {
      try { u(); } catch { /* ignore */ }
    };
  }, []);

  return (
    <div className="page">
      <div className="card">
        <div className="cardHeader">
          <strong>Issues</strong>
          <div className="row">
            <button className="btn" onClick={refresh}>Refresh</button>
          </div>
        </div>

        <div className="sectionTitle" style={{ marginTop: 16 }}>Recent issues</div>
        <div className="muted">Editors record issues from Today. QA/admin updates status.</div>
        <div className="list" style={{ marginTop: 8 }}>
          {issues.length === 0 ? <div className="muted">No issues recorded.</div> : null}
          {issues.map((it) => (
            <div key={it.id} className="listRow">
              <div className="listMain">
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <strong>{it.severity.toUpperCase()} • {it.code}</strong>
                  <span className="muted">{fmtEat(it.createdAtIso)}</span>
                </div>
                <div className="muted" style={{ marginTop: 4 }}>{it.message}</div>
                <div className="muted" style={{ marginTop: 4 }}>
                  Status: {it.acknowledged ? `Reviewed (${fmtEat(it.acknowledgedAtIso)})` : 'Open'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
