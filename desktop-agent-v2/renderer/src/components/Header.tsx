import React from 'react';

type Props = {
  title: string;
  online: boolean | null;
  platform?: string | null;
  activeSession?: { sessionId: string; eventId: string | null; serverSessionId: string | null } | null;
};

function pillClass(kind: 'ok' | 'warn' | 'neutral') {
  if (kind === 'ok') return 'pill pillOk';
  if (kind === 'warn') return 'pill pillWarn';
  return 'pill pillNeutral';
}

export function Header(props: Props) {
  const onlineKind = props.online === true ? 'ok' : props.online === false ? 'warn' : 'neutral';
  const onlineLabel = props.online === true ? 'Online' : props.online === false ? 'Offline' : 'Unknown';

  const sessionLabel = props.activeSession?.eventId
    ? `Session: ${props.activeSession.eventId}`
    : props.activeSession?.sessionId
      ? `Session: ${props.activeSession.sessionId}`
      : 'No active session';

  return (
    <div className="header">
      <div className="headerLeft">
        <div className="brand">
          <div className="brandMark">G1</div>
          <div>
            <div className="brandTitle">{props.title}</div>
            <div className="brandSub">Desktop Agent v2</div>
          </div>
        </div>
      </div>

      <div className="headerRight">
        <span className={pillClass(onlineKind)}>{onlineLabel}</span>
        <span className={pillClass('neutral')}>{props.platform ?? '-'}</span>
        <span className={pillClass(props.activeSession ? 'ok' : 'neutral')}>{sessionLabel}</span>
      </div>
    </div>
  );
}
