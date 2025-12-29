import React from 'react';

type Props = {
  title: string;
  subtitle?: string;
  online: boolean | null;
  platform?: string | null;
  activeEvent?: { id: number | null; name: string | null } | null;
  activeSession?: { sessionId: string; eventId: string | null; serverSessionId: string | null } | null;
  attention?: boolean;
};

function pillClass(kind: 'ok' | 'warn' | 'neutral' | 'blue' | 'red') {
  if (kind === 'ok') return 'pill pillOk';
  if (kind === 'warn') return 'pill pillWarn';
  if (kind === 'blue') return 'pill pillBlue';
  if (kind === 'red') return 'pill pillRed';
  return 'pill pillNeutral';
}

export function BrandHero(props: Props) {
  const status = (() => {
    if (props.attention) return { kind: 'warn' as const, label: 'Attention' };
    if (props.online === false) return { kind: 'red' as const, label: 'Offline' };
    if (props.online === true && props.activeSession?.serverSessionId) return { kind: 'ok' as const, label: 'Live' };
    if (props.online === true) return { kind: 'blue' as const, label: 'Ready' };
    return { kind: 'neutral' as const, label: 'Starting…' };
  })();

  const mascotUrl = new URL('../assets/mascot.svg', import.meta.url).toString();

  const activeEventLabel = (() => {
    const ev = props.activeEvent;
    if (!ev || !ev.id) return 'No active event';
    if (ev.name) return ev.name;
    return `Event ${ev.id}`;
  })();

  const sessionLabel = props.activeSession?.eventId
    ? `Event ${props.activeSession.eventId}`
    : props.activeSession?.sessionId
      ? `Session ${props.activeSession.sessionId}`
      : 'No active session';

  return (
    <div className="brandHero">
      <div className="brandBanner">
        <div className="brandBannerLeft">
          <div className="brandBannerTitle">{props.title}</div>
          <div className="brandBannerSub">{props.subtitle ?? 'Desktop Agent v2'}</div>
        </div>
        <div className="brandBannerRight">
          <span className={pillClass(status.kind)}>{status.label}</span>
          <span className={pillClass('neutral')}>{props.platform ?? '-'}</span>
          <span className={pillClass(props.activeEvent?.id ? 'blue' : 'warn')}>{activeEventLabel}</span>
          <span className={pillClass(props.activeSession ? 'ok' : 'neutral')}>{sessionLabel}</span>
        </div>
      </div>

      <div className="mascotWrap">
        <div className="mascotCard">
          <div className="mascotArt" aria-hidden="true">
            <img src={mascotUrl} alt="" style={{ width: 240, height: 160, objectFit: 'contain' }} />
          </div>
          <div className="mascotText">
            <div className="mascotHeadline">Ready to guide the workflow</div>
            <div className="mascotSub">
              Insert SD  snapshot  verify copy  backup  safe removal.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
