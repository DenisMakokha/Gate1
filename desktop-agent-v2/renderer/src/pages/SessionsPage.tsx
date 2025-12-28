import React from 'react';

type Props = {
  coreStatus: any;
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

export function SessionsPage(props: Props) {
  const a = props.coreStatus?.activeSession ?? null;
  return (
    <div className="page">
      <div className="card">
        <div className="cardHeader">
          <strong>Sessions</strong>
          <span className="muted">Windows-first</span>
        </div>

        {!a ? <div className="muted">No active session.</div> : null}

        {a ? (
          <div className="list" style={{ marginTop: 8 }}>
            <div className="listRow">
              <div className="listMain">
                <strong>Session</strong>
                <div className="muted" style={{ marginTop: 4 }}>ID: {String(a.sessionId ?? '-')}</div>
                <div className="muted" style={{ marginTop: 4 }}>Status: {String(a.status ?? '-')}</div>
              </div>
            </div>

            <div className="listRow">
              <div className="listMain">
                <strong>Binding</strong>
                <div className="muted" style={{ marginTop: 4 }}>Camera: {String(a.binding?.cameraNumber ?? '-')}</div>
                <div className="muted" style={{ marginTop: 4 }}>SD: {String(a.binding?.sdLabel ?? '-')}</div>
              </div>
            </div>

            <div className="listRow">
              <div className="listMain">
                <strong>Server</strong>
                <div className="muted" style={{ marginTop: 4 }}>Event: {String(a.eventId ?? '-')}</div>
                <div className="muted" style={{ marginTop: 4 }}>Server session: {String(a.serverSessionId ?? '-')}</div>
              </div>
            </div>

            <div className="listRow">
              <div className="listMain">
                <strong>Timing</strong>
                <div className="muted" style={{ marginTop: 4 }}>Started: {fmtEat(a.startedAtIso)}</div>
                <div className="muted" style={{ marginTop: 4 }}>Updated: {fmtEat(a.updatedAtIso)}</div>
              </div>
            </div>
          </div>
        ) : null}

        <div className="muted" style={{ marginTop: 8 }}>
          Session binding + SD workflows are Windows-only for now.
        </div>
      </div>
    </div>
  );
}
